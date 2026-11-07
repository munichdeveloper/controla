# Deploy Controla on Hostinger VPS

The README button opens Docker Manager with the standalone
`docker-compose.hostinger.yml`. It does not provision DNS, install a proxy or
generate secrets. Supply the settings below before pressing Deploy.
The ordinary `docker-compose.yml` remains the local setup; do not combine these
files with multiple `-f` options.

## Prerequisites

- Linux x86-64 VPS with Docker Manager and a publicly pullable Controla image.
- One Docker-aware Traefik using `network_mode: host`, listening on 80/443,
  with entrypoints `web`/`websecure`, Docker discovery and an ACME resolver named
  `letsencrypt`. This matches the existing Hostinger VPS diagnosed for this project.
- Your hostname points to the VPS. Set an AAAA record only if IPv6 works.
  Ports 80 and 443 must be reachable for HTTP validation and HTTPS.

Traefik uses the application's project-scoped bridge IP; neither application,
backend nor PostgreSQL publishes a host port. Multiple installations may coexist.
If your proxy uses bridge networking instead, persistently attach it to the app's
`<project>_default` network in the proxy's Compose file. Do not assume an external
`traefik-proxy` network already exists.

### New VPS: configure the proxy once

Reuse an existing suitable proxy. Do not launch a second proxy on occupied ports
80/443. For a fresh VPS, deploy this separate project once with your `ACME_EMAIL`:

```yaml
services:
  traefik:
    image: traefik:v3.7
    restart: unless-stopped
    network_mode: host
    command:
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL:?Set ACME_EMAIL}
      - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - certificates:/letsencrypt
volumes:
  certificates:
```

The proxy requires trusted administrative access to Docker's socket. Do not
expose a dashboard or Docker API publicly.

## New installation

Choose a unique project name in Docker Manager and set these environment values:

| Variable | Value |
| --- | --- |
| `CONTROLA_HOST` | DNS hostname, e.g. `controla.srv123.hstgr.cloud`; no scheme, port or path |
| `POSTGRES_PASSWORD` | Unique random password |
| `CONTROLA_SECURITY_MASTER_KEY` | Unique persistent secret, at least 32 characters |
| `JWT_SECRET` | Another unique persistent secret, at least 32 characters |
| `CONTROLA_IMAGE` | Optional version, commit-specific `sha-<full commit>` tag or immutable `@sha256:...` digest; defaults to `ghcr.io/munichdeveloper/controla:main` |

Compose rejects missing required values. Frontend URL and allowed origins derive
from `CONTROLA_HOST`. Browser requests use same-origin `/api`; Next.js forwards
them to the backend inside the same container. No domain-specific build is needed.
Optional SMTP and Core settings are listed in Compose. Configure SMTP for mail
and password-reset delivery.

To generate credentials from a checkout (Python 3 required):

```bash
python3 deploy/hostinger-env.py controla.example.com --project controla
```

This creates `.env.hostinger` without displaying its secrets and refuses to replace
an existing file. Transfer its values privately into Docker Manager. On Windows,
keep the file in a private user directory; Unix creation mode is 0600. Never commit
it. Alternatively, deploy from a checkout on the VPS:

```bash
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml config --quiet
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml up -d
```

Open `https://<CONTROLA_HOST>/login`. Retrieve the initial `admin` password privately
from application logs. Complete the rotation procedure below before adding instances.
Check `/api/license` returns JSON,
the app becomes healthy, and TLS is trusted. Container startup alone is insufficient.

### Set up admin email and rotate the bootstrap password

There is currently no change-password action in the account UI. The bootstrap
account has the placeholder address `admin@controla.local`, so SMTP configuration
alone does not make password reset usable. Configure working SMTP, then assign
your actual deliverable email address using PostgreSQL. From a VPS checkout,
replace `you@example.com` before running:

```bash
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml exec postgres \
  psql -U controla_user -d controla \
  -c "UPDATE users SET email = 'you@example.com', updated_at = CURRENT_TIMESTAMP WHERE username = 'admin';"
```

In Docker Manager the same SQL can be run in the PostgreSQL terminal. Expect
`UPDATE 1`. Open `https://<CONTROLA_HOST>/forgot-password`, enter that address,
follow the emailed link, set a strong password, and verify a fresh login.
Do this before storing instance credentials. Keep the bootstrap password private
until rotation is verified; do not enable debug endpoints to change passwords.

Development debug endpoints are disabled by default and explicitly disabled in
the Hostinger file. Local developers may opt in using `CONTROLA_DEBUG_ENABLED=true`;
they still require an authenticated administrator. Never enable them publicly.

## Images and button rollout

`Publish Docker image` builds and smoke-tests PostgreSQL login, same-origin API,
health, supervision and HTTPS routing before publishing. Main publishes `:main`
and `:sha-<full commit>`; a `vX.Y.Z` tag also publishes `:X.Y.Z`. Manual runs publish
the SHA tag and publish `:main` only when run on main. Images target Linux amd64.

Before advertising the button, merge these changes, wait for a successful publish
and make the GHCR package **public** in GitHub package settings. GitHub may create
it as private initially. Verify an unauthenticated pull from a fresh VPS; a
maintainer's authenticated pull does not prove public access. The button tracks
main; pin its Compose URL to a release tag if desired.

## Updates and existing installations

Back up PostgreSQL and the matching environment secrets first. Keep the project
name, database/user names, data volume and keys. Do not rerun the generator,
replace credentials or delete data volumes on an existing installation. Changing
the master key makes previously encrypted instance credentials unreadable.

This file is for new installations, not a blind migration command. Existing
deployments may have different database/user names, networks or volume names.
Preserve those explicitly before switching files, especially the current
`postgres_data` volume identity and existing secrets. This change performs no
automatic migration of an existing VPS.

For an installation already using this file, choose a published image version and
use Docker Manager's pull/redeploy action or:

```bash
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml pull
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml up -d
```

The healthcheck probes `/login` and `/api/license`. The supervisor exits if Java or
Next.js exits, allowing Docker to restart the service. An unhealthy check alone
does not trigger Docker's restart policy. Database migrations may require restoring
the matching database backup when rolling back, rather than changing only the image.

References: [Hostinger button](https://www.hostinger.com/support/deploy-on-hostinger-button/)
and [Traefik integration](https://www.hostinger.com/support/connecting-multiple-docker-compose-projects-using-traefik-in-hostinger-docker-manager/).
