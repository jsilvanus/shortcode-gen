# Documentation Status

**Last reviewed:** 2026-08-26

The documentation is intentionally divided between historical design and current implementation.

| Document | Purpose | Status |
|---|---|---|
| `first-plan.md` | Historical first implementation plan | Historical/preserved |
| `technical-plan.md` | Earlier detailed technical plan | Historical; may differ from implementation |
| `plan2.md` | Earlier deployment/implementation plan | Historical; may differ from implementation |
| `architecture.md` | Current architecture | Current |
| `features.md` | Current feature inventory | Current |
| `roadmap.md` | Current gaps and future work | Current |
| `data-inventory.md` | Current privacy-oriented data inventory | Current, needs updates when schema changes |
| `privacy.md` | Privacy/data-protection implementation assessment | Current engineering assessment |
| `security.md` | Security architecture and risks | Current engineering assessment |
| `privacy-security-assessment.md` | ISO/GDPR-oriented self-assessment | Current self-assessment, not certification |
| `operations.md` | Deployment and operational guidance | Current, deployment verification still required |
| `api.md` | Current API overview | Partial reference |
| `mcp.md` | MCP architecture/security overview | Partial reference |

## Source-of-truth rules

1. Code is the source of truth for what is implemented.
2. Current documentation describes the implementation observed on `main`.
3. Historical plans are not silently rewritten.
4. A feature described as planned must not be presented as implemented merely because a plan exists for it.
5. Security/privacy documents describe engineering controls and risks; they do not create legal guarantees.

## Updating documentation

When a significant schema or security-sensitive feature changes:

1. update `architecture.md`;
2. update `features.md`;
3. update `data-inventory.md` if data processing changes;
4. update `privacy.md` and/or `security.md` as appropriate;
5. update `roadmap.md` if a planned item becomes implemented;
6. reconsider the standards self-assessment.
