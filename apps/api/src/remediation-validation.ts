export const PREFLIGHT_MAX_AGE_MS = 15 * 60 * 1000;

export function proposalExecutionError(status: string): string | null {
  return status === 'approved' ? null : 'proposal_not_approved';
}

export function preflightExecutionError(
  preflight: {
    proposalId: string;
    conflict: boolean;
    createdAt: Date;
  } | null,
  proposalId: string,
  latestPreflightId: string | null,
  preflightId: string,
  now = Date.now(),
): string | null {
  if (!preflight || preflight.proposalId !== proposalId || preflight.conflict)
    return 'invalid_preflight';

  const age = now - preflight.createdAt.getTime();
  if (!Number.isFinite(age) || age < 0 || age > PREFLIGHT_MAX_AGE_MS)
    return 'preflight_expired';

  if (latestPreflightId !== preflightId)
    return 'preflight_not_latest';

  return null;
}

export function rollbackEligibilityError(status: string | null): string | null {
  return status === 'verified' ? null : 'execution_not_verified';
}
