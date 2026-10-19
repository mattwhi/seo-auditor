import { NextRequest, NextResponse } from 'next/server';
import { currentUser, db } from '../../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Small, dependency-free, text-based PDF renderer. Data comes from a completed, saved audit.
function pdf(lines: string[]): Buffer {
  const objects: string[] = [];
  const add = (content: string) => { objects.push(content); return objects.length; };
  const catalog = add('');
  const pages = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const pageIds: number[] = [];
  for (let offset = 0; offset < lines.length; offset += 48) {
    const chunk = lines.slice(offset, offset + 48);
    const esc = (value: string) => value.normalize('NFKD').replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\$&');
    const content = ['BT', '/F1 10 Tf', '50 785 Td', '14 TL', ...chunk.map((line, index) => `${index ? 'T* ' : ''}(${esc(line.slice(0, 112))}) Tj`), 'ET'].join('\n');
    const stream = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  let cursor = Buffer.byteLength(chunks[0]);
  for (const [index, obj] of objects.entries()) {
    offsets.push(cursor);
    const block = `${index + 1} 0 obj\n${obj}\nendobj\n`;
    chunks.push(block); cursor += Buffer.byteLength(block);
  }
  const xref = cursor;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (const offset of offsets.slice(1)) chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.from(chunks.join(''), 'utf8');
}

export async function GET(req: NextRequest, context: { params: Promise<{ auditId: string }> }) {
  const actor = await currentUser(req);
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { auditId } = await context.params;
  if (!/^[a-z0-9_-]{1,128}$/i.test(auditId)) return NextResponse.json({ error: 'invalid_audit' }, { status: 400 });
  const audit = await db.audit.findUnique({ where: { id: auditId }, include: { project: true, _count: { select: { pages: true, issues: true, crawlFailures: true } } } });
  if (!audit) return NextResponse.json({ error: 'audit_not_found' }, { status: 404 });
  if (audit.status !== 'completed') return NextResponse.json({ error: 'audit_not_completed' }, { status: 409 });
  const issues = await db.issue.findMany({ where: { auditId }, select: { ruleId: true, severity: true, message: true, page: { select: { url: true } } }, orderBy: { severity: 'asc' }, take: 1500 });
  const severityCounts = await db.issue.groupBy({ by: ['severity'], where: { auditId }, _count: { _all: true } });
  const counts = new Map(severityCounts.map((row) => [row.severity, row._count._all]));
  const lines = [
    'SEO AUDITOR  |  TECHNICAL SEO AUDIT REPORT',
    '==============================================================',
    `Project: ${audit.project.name}`,
    `Website: ${audit.project.baseUrl}`,
    `Audit date: ${(audit.completedAt ?? audit.createdAt).toISOString().slice(0, 10)}`,
    `Audit ID: ${audit.id}`,
    '', 'EXECUTIVE SUMMARY',
    `SEO score: ${audit.score ?? 'Not available'}`,
    `Pages crawled: ${audit._count.pages}`,
    `Issues found: ${audit._count.issues}`,
    `Crawl failures: ${audit._count.crawlFailures}`,
    `Severity breakdown: ${Array.from(counts).map(([severity, count]) => `${severity}: ${count}`).join(' | ') || 'No issues'}`,
    '', 'RECOMMENDED PRIORITIES',
    'Address critical and high-severity findings first. Verify fixes with a new audit.',
    'Review affected URLs and rule evidence before making changes.',
    '', 'DETAILED FINDINGS (first 1,500)',
  ];
  for (const [index, issue] of issues.entries()) {
    lines.push(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.ruleId}: ${issue.message}`);
    if (issue.page?.url) lines.push(`   URL: ${issue.page.url}`);
  }
  lines.push('', 'METHODOLOGY & LIMITATIONS', 'This report reflects the saved crawl snapshot, not live site conditions.', 'The report includes at most 1,500 detailed findings; totals cover the full audit.', 'Validate recommendations before applying production changes.');
  const output = pdf(lines);
  return new NextResponse(new Uint8Array(output), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="seo-audit-${audit.id}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
