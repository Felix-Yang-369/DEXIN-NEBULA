# Private File Storage Integration

**Status:** Implemented baseline / operational acceptance environment-dependent

## Architecture

~~~text
Browser → authenticated Next.js operation → permission and metadata check
        → private file adapter → private binary storage

PostgreSQL stores metadata, folder policy, grants, access requests, and audit.
~~~

The browser never receives private storage credentials or a direct stable download URL. Upload and download requests pass through application authentication and document/folder authorization.

## Configuration

Connection endpoint, root path, service identity, password, timeout, and trust material are server-only runtime secrets. Documentation, logs, screenshots, and source control must not contain their real values. Use separate credentials per environment and grant only the required storage scope.

## Storage Paths

Database records store a relative opaque storage path, not a credential-bearing URL. Normalize and validate paths to prevent traversal, and generate server-owned object names to avoid unsafe user input.

## Consistency and Failure Handling

- On upload, validate metadata and permission before sending the binary.
- Record database metadata only after storage success, or compensate safely if the metadata write fails.
- On download, re-check current access instead of trusting an old link.
- On delete/archive, prefer recoverable state and record failures for reconciliation.
- Logs include a safe trace identifier but not authorization headers, credentials, or document bodies.

## Acceptance

Verify permitted and forbidden roles, folder grants, upload limits/types, download authorization, unavailable storage, timeout, partial failure/reconciliation, TLS trust, credential rotation, backup, and restoration with synthetic documents.

Exact provider, private network topology, host addresses, ports, usernames, certificate locations, and production recovery commands belong in an access-controlled operations system.
