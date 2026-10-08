# v0.8.2 — Operator-gated remediation proposals

This release **does not modify WordPress**. It adds persisted draft/approve/reject decisions as the first safety boundary before a future execution and rollback engine.

## Security

- API-only `REMEDIATION_OPERATOR_TOKEN` (minimum 32 characters), supplied via the API container environment. Keep out of Git, browser JavaScript, logs, and chat.
- No public UI controls for approval until user sessions, CSRF protection, and per-project roles exist.
- Use HTTPS/private-network access to the API. The existing broader API is not fully authenticated; do not expose it publicly.
- Only allowlisted title/description rule IDs can create proposals; this does **not** imply those fields can be written safely to core WordPress (Rank Math / Yoast are plugin-specific).
- Each proposal must resolve to one verified WordPress REST content object; ambiguous mappings are rejected.
- Approvals are atomic (`draft` -> `approved` or `rejected`), and are never interpreted as permission to execute.
- Prisma schema includes `RemediationProposal`. Run your established schema deployment process with a reviewed migration; **do not** reset or drop existing data.

## API (operator token required)

`Authorization: Bearer <token>` on every request:

- `GET /api/v1/projects/:projectId/wordpress/proposals`
- `POST /api/v1/projects/:projectId/wordpress/proposals` body: `{ "auditId": "...", "issueId": "...", "targetType": "posts|pages|product", "targetId": 123, "proposedText": "..." }`
- `POST /api/v1/wordpress/proposals/:proposalId/approve`
- `POST /api/v1/wordpress/proposals/:proposalId/reject`

All proposals have `executable: false` in responses. No WordPress POST/PATCH/PUT/DELETE is implemented.

## Next

Operator login and session security, versioned migrations, safe metadata adapter, original-value snapshots, conflict detection, execution idempotency, post-write verification, rollback, and detailed audit logs are prerequisites to write-enabled remediation.

## Docker configuration

The included `compose.remediation.yml` adds a protected **API-only** env file.
Create `/opt/seo-auditor/secrets/remediation.env` with `REMEDIATION_OPERATOR_TOKEN=<cryptographically-random-64+-character-token>`, owner `root:root`, mode `0600`. The Docker daemon reads the file during container creation. Add `-f compose.remediation.yml` after the other production overrides in the VM deployment script. Keep the override file on the VM (the deployment script does not sync repository files). Never add this token to the shared `.env`, because the web and worker containers also load it.
