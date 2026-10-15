import { currentUser, db, sameOrigin, SESSION_COOKIE } from '../../../lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
const error = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
// The authenticated dashboard session is validated again by the API.
// The API validates the same revocable admin session independently.
async function upstream(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown,
  sessionToken?: string,
) {
  const token = sessionToken;
  if (!token) return error('authentication_required', 401);
  let response: Response;
  try {
    response = await fetch(new URL(endpoint, API), {
    method,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return error('remediation_service_unavailable', 502);
  }
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
// Narrow unknown request values before they can enter upstream URLs or audit records.
// Prisma cuid() identifiers and existing imported IDs are alphanumeric with -/_ only.
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
const projectId = validId;
const objectId = validId;

async function recordDecision(
  actorId: string,
  action: string,
  targetId: string,
  response: Response,
) {
  // An upstream success must not become a failed browser request merely because
  // the secondary activity log is temporarily unavailable.
  try {
    await db.dashboardAdminEvent.create({
      data: {
        actorId,
        action,
        targetId,
        details: { upstreamStatus: response.status, succeeded: response.ok },
      },
    });
  } catch (err) {
    console.error('remediation_activity_log_failed', err instanceof Error ? err.message : 'unknown');
  }
}

export async function GET(req: NextRequest) {
  const dashboardUser = await currentUser(req);
  if (!dashboardUser || dashboardUser.role !== 'ADMIN') return error('forbidden', 403);
  const action = req.nextUrl.searchParams.get('action');
  if (action === 'session')
    return NextResponse.json(
      {
        configured: true,
        authenticated: true,
        executionConfigured: true,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );

  const project = req.nextUrl.searchParams.get('projectId');
  const proposal = req.nextUrl.searchParams.get('proposalId');
  if (action === 'proposals' && projectId(project))
    return upstream('GET', `/api/v1/projects/${project}/wordpress/proposals`, undefined, req.cookies.get(SESSION_COOKIE)?.value);
  if (action === 'preflights' && objectId(proposal))
    return upstream('GET', `/api/v1/wordpress/proposals/${proposal}/preflights`, undefined, req.cookies.get(SESSION_COOKIE)?.value);
  if (action === 'execution' && objectId(proposal))
    return upstream('GET', `/api/v1/wordpress/proposals/${proposal}/execution`, undefined, req.cookies.get(SESSION_COOKIE)?.value);
  return error('invalid_request', 400);
}
export async function POST(req: NextRequest) {
  const dashboardUser = await currentUser(req);
  if (!dashboardUser || dashboardUser.role !== 'ADMIN') return error('forbidden', 403);
  if (!sameOrigin(req) || req.headers.get('x-remediation-intent') !== '1')
    return error('csrf_check_failed', 403);
  let data: Record<string, unknown>;
  try {
    data = await req.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error();
  } catch {
    return error('invalid_json', 400);
  }
  const action = data.action;

  const project = data.projectId,
    proposal = data.proposalId;
  if (action === 'create' && projectId(project)) {
    const body = data.payload;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return error('invalid_proposal', 400);
    return upstream('POST', `/api/v1/projects/${project}/wordpress/proposals`, body, req.cookies.get(SESSION_COOKIE)?.value);
  }
  if (action === 'delete' && objectId(proposal) && data.confirm === 'DELETE_UNUSED_PROPOSAL') {
    try {
      await db.$transaction(async (tx) => {
        const existing = await tx.remediationProposal.findUnique({ where: { id: proposal } });
        if (!existing) throw new Error('proposal_not_found');
        if (!['draft', 'approved', 'rejected'].includes(existing.status)) throw new Error('proposal_not_deletable');
        const execution = await tx.remediationExecution.findFirst({ where: { proposalId: proposal }, select: { id: true } });
        if (execution) throw new Error('proposal_has_execution_history');
        // Conditional delete prevents a concurrent status transition from being silently deleted.
        const removed = await tx.remediationProposal.deleteMany({ where: { id: proposal, status: existing.status } });
        if (removed.count !== 1) throw new Error('proposal_changed');
        await tx.remediationPreflight.deleteMany({ where: { proposalId: proposal } });
        await tx.dashboardAdminEvent.create({ data: { actorId: dashboardUser.id, action: 'remediation.delete_unused', targetId: proposal, details: { projectId: existing.projectId, ruleId: existing.ruleId, pageUrl: existing.pageUrl } } });
      });
      return NextResponse.json({ deleted: true });
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'delete_failed';
      return error(reason, reason === 'proposal_not_found' ? 404 : 409);
    }
  }
  if (objectId(proposal)) {
    if (action === 'approve' || action === 'reject' || action === 'preflight') {
      const response = await upstream('POST', `/api/v1/wordpress/proposals/${proposal}/${action}`, undefined, req.cookies.get(SESSION_COOKIE)?.value);
      await recordDecision(dashboardUser.id, `remediation.${action}`, proposal, response);
      return response;
    }
    if (
      action === 'execute' &&
      objectId(data.preflightId) &&
      data.confirm === 'EXECUTE_APPROVED_REMEDIATION'
    ) {
      const response = await upstream(
        'POST',
        `/api/v1/wordpress/proposals/${proposal}/execute`,
        { preflightId: data.preflightId, confirm: data.confirm },
        req.cookies.get(SESSION_COOKIE)?.value,
      );
      await recordDecision(dashboardUser.id, 'remediation.execute', proposal, response);
      return response;
    }
    if (action === 'rollback' && data.confirm === 'ROLLBACK_REMEDIATION') {
      const response = await upstream(
        'POST',
        `/api/v1/wordpress/proposals/${proposal}/rollback`,
        { confirm: data.confirm },
        req.cookies.get(SESSION_COOKIE)?.value,
      );
      await recordDecision(dashboardUser.id, 'remediation.rollback', proposal, response);
      return response;
    }
  }
  return error('invalid_request', 400);
}
