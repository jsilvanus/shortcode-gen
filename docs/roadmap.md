# Shortcode Gen Roadmap

This roadmap is based on the current repository, not the original implementation plans.

## Production-readiness work

### High priority

- Complete a code-level security review of every public/API/MCP authorization path.
- Verify domain isolation with explicit regression tests.
- Verify SSRF protections for DNS rebinding, redirect chains, IPv4/IPv6 edge cases and browser rendering.
- Verify Playwright sandbox/container/network restrictions in the production image.
- Document and test screenshot persistence and restoration.
- Verify production migration and rollback procedures.
- Add/verify health/readiness behaviour for both web and worker.
- Establish explicit retention periods for analytics, audit logs, sessions and expired links.
- Decide and document operator responsibilities for GDPR data-subject requests.
- Verify backup and restore procedures with the separate PostgreSQL project.
- Perform a dependency/security update pass and document the resulting baseline.

## Documentation work

- Keep `architecture.md` synchronized with actual architecture.
- Keep `features.md` synchronized with implementation.
- Maintain `data-inventory.md` when schema changes.
- Maintain `privacy.md` and `security.md` as implementation changes.
- Complete `api.md` and `mcp.md` from the actual routes/tools.
- Complete `operations.md` from the actual Compose/Docker deployment.
- Re-run the standards-oriented self-assessment after major security/privacy changes.

## Privacy/security work

- Establish a complete processing inventory for visitor analytics.
- Decide whether visitor hashes are necessary for each deployment and define their retention.
- Define retention/deletion rules for audit logs.
- Define retention/deletion rules for links and their screenshots.
- Document legal-basis responsibilities for the operator rather than hard-coding a universal legal basis into the software.
- Assess whether a Data Protection Impact Assessment (DPIA) is required for a particular deployment.
- Create an incident-response procedure.
- Create a security-risk register and review cadence.

## API/MCP work

- Produce a complete API reference from the current routes.
- Document authentication and domain scoping for every API surface.
- Produce a complete MCP tool/resource reference from the implementation.
- Add automated authorization tests for API and MCP operations.

## Nice-to-have / future

- More configurable preview generation.
- More advanced link analytics.
- Additional QR customization.
- Additional integrations.
- More automation around metadata refresh and maintenance.

These are intentionally not treated as commitments until requirements are defined.

## Explicitly not claimed

The project currently does **not** claim:

- GDPR compliance certification;
- ISO/IEC 27001 certification;
- ISO/IEC 27701 certification;
- an independent penetration test;
- an independent privacy audit;
- a legal opinion on any operator's GDPR obligations.

The project can nevertheless implement engineering controls aligned with these frameworks. The current self-assessment is documented separately.
