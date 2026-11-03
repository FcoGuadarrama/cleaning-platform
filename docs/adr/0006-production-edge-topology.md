# ADR 0006 — Production edge topology: Authenticated Origin Pulls + network segmentation (2026-11-03, accepted)

**Context.** `docs/ARCHITECTURE.md` already specifies Cloudflare (Full (strict) TLS with an origin
certificate) → Nginx → api / dashboard static, with MySQL confined to the internal compose network.
Implementing `docker-compose.prod.yml` and `infra/nginx/` required two decisions not spelled out there.

**Decision 1: Authenticated Origin Pulls (mTLS), not just Full (strict).** Full (strict) alone makes
Cloudflare validate the origin's certificate, but the origin still accepts any TLS client that reaches
it on 443 — if the origin IP leaks (misconfigured DNS, scanning, a developer's `/etc/hosts` entry), the
app is directly reachable, bypassing Cloudflare's WAF/rate limiting and the `set_real_ip_from` trust
boundary entirely. `infra/nginx/default.conf` also sets `ssl_client_certificate
/etc/nginx/tls/cloudflare-origin-pull-ca.pem` with `ssl_verify_client on`, so the origin only completes a
TLS handshake with clients presenting Cloudflare's pull certificate. Plain HTTP (port 80) returns `444`
(connection closed, no response) rather than serving anything, for the same reason.

**Decision 2: Two Docker networks, not one.** `backend` (`internal: true`) holds `mysql`, `migrate`, and
`api`; `edge` holds `api` and `nginx`. Only `nginx` publishes host ports. This means `api` can reach
`mysql` and `nginx` can reach `api`, but `mysql` has no path to the host or to any network reachable from
outside the compose project, independent of whether anyone remembers to omit a `ports:` line on `mysql`
later — the `internal: true` network is the enforcement point, not developer discipline.

**Consequence.** Origin cert, origin key, and the Cloudflare origin-pull CA must all be present under
`${SECRETS_DIR}/tls/` before `nginx` can start (see `.env.prod.example`); rotating any of the three is an
infra change, not a code change. If Cloudflare ever changes how Authenticated Origin Pulls certificates
are issued/rotated, this ADR is the pointer to update.
