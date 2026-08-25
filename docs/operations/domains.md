# Domain and TLS Operations (Sanitized)

Canonical deployment guidance is in [Deployment](../engineering/DEPLOYMENT.md). Exact production domains, DNS records, addresses, upstream ports, callback registrations, and certificate paths are private operational configuration.

## Separation of Concerns

Use separate HTTPS origins for the authenticated business application and any public presentation site. The public site must not share internal sessions, call private APIs, or become an authentication callback target.

## Rollout Order

1. Complete required registration/compliance for the chosen domain and hosting jurisdiction.
2. Configure DNS and valid TLS certificates through approved providers.
3. Route each hostname to its intended application and reject unknown hosts.
4. Configure application, managed-authentication, and enterprise-identity callbacks with exact HTTPS URLs in the private operations system.
5. Validate TLS, login/logout/recovery, callback state, protected routes, forwarded headers, and cookie boundaries before enabling users.

## Reverse Proxy Principles

- Redirect plain HTTP to HTTPS.
- Preserve the validated host/protocol/client forwarding headers.
- Keep application upstream ports private.
- Apply request-size and timeout policies appropriate to application and file operations.
- Do not expose provider default hostnames or raw server addresses as supported entry points.

## Acceptance

Verify origin separation, certificates, authentication flows, callback allowlists, secure cookies, protected API behavior, file download authorization, host rejection, and logging without secrets. Store exact operational values outside repository documentation.
