# MCP

Shortcode Gen contains an MCP HTTP endpoint and a dedicated MCP server implementation.

## Purpose

MCP provides an agent-facing interface to Shortcode Gen without requiring an agent to operate the web UI directly.

## Security model

MCP must be treated as an administrative/programmatic access surface, not as a public convenience endpoint. Authentication, domain authorization and resource ownership rules must apply to MCP operations just as they do to API operations.

## Current implementation

The repository contains:

- an MCP route under `app/api/mcp/`;
- an MCP server implementation under `lib/mcp/`;
- the MCP SDK dependency.

## Domain scope

Operations that read or mutate links, collections, domains, settings or other tenant data must resolve the caller's permitted domain context. An MCP client must not be able to select an arbitrary domain simply by supplying its ID.

## Privacy

MCP responses can expose the same information available through the underlying API. Therefore:

- do not expose secrets;
- preserve domain isolation;
- avoid unnecessary personal data;
- apply existing audit expectations to mutating operations.

## Documentation status

The MCP implementation exists, but a complete tool-by-tool reference is still a documentation task. The next MCP documentation pass should enumerate every exposed tool/resource, its input schema, authorization requirements and examples directly from the implementation.

## Operational warning

Do not expose the MCP endpoint to an untrusted network until its authentication and authorization configuration has been verified for the deployment.
