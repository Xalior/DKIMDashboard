# DKIM Dashboard — Documentation

## Architecture

Built with:

- **Next.js 16** — App Router with API routes
- **React-Bootstrap** — UI components
- **Bootstrap Icons** — Iconography
- **Node.js `crypto`** — Pure TypeScript RSA key generation
- **Node.js `dns/promises`** — Live DNS verification

### Project Structure

```
├── app/
│   ├── page.tsx                        # Dashboard overview
│   ├── domains/page.tsx                # Domain management
│   ├── rules/signing/                  # Signing rules (list / new / [id])
│   ├── rules/keys/[id]/page.tsx        # Per-key detail view
│   ├── keys/page.tsx                   # Key listing
│   ├── trusted-hosts/                  # List / new / [id] per-entry UI
│   ├── config/page.tsx                 # Config viewer
│   └── api/
│       ├── domains/                    # Signing-domain CRUD (with narrow delete)
│       ├── rules/signing/              # Signing rule CRUD + reorder
│       ├── rules/keys/                 # Key table listing + per-key detail
│       ├── keys/generate/              # RSA key generation
│       ├── dns/                        # DNS verification
│       ├── trusted-hosts/              # Per-entry trusted host CRUD
│       ├── config/                     # Config file reader
│       └── service/                    # OpenDKIM reload (SIGUSR1)
├── lib/
│   ├── opendkim.ts                     # Core library
│   ├── signing-table.ts                # Round-trip-safe SigningTable parser/writer
│   ├── key-table.ts                    # Round-trip-safe KeyTable parser/writer
│   ├── trusted-hosts.ts                # Round-trip-safe TrustedHosts parser/writer
│   ├── atomic-fs.ts                    # tmp-then-rename atomic writes
│   ├── write-lock.ts                   # Per-file async mutex
│   ├── errors.ts                       # DuplicateEntryError, NotFoundError
│   └── api-errors.ts                   # Uniform JSON error responses
├── components/
│   ├── Navbar.tsx                      # Navigation
│   ├── AboutThisPage.tsx               # Per-page help panel
│   ├── FieldTooltip.tsx                # Per-field help popovers
│   ├── RowHelp.tsx                     # Per-row help drawers
│   └── help/                           # Per-page help content
├── data/                               # Local OpenDKIM config (gitignored)
└── docs/                               # This directory
```

## Core Library — `lib/opendkim.ts`

All OpenDKIM file operations and key generation live in a single module. It reads paths from environment variables so the same code works against local example data or a live server.

### Configuration

Three env vars control where the library looks for files:

| Variable | Default | Contents |
|----------|---------|----------|
| `OPENDKIM_CONFIG_DIR` | `/etc/opendkim` | `SigningTable`, `KeyTable`, `TrustedHosts`, `keys/` |
| `OPENDKIM_CONF` | `/etc/opendkim.conf` | Main OpenDKIM config |
| `OPENDKIM_PID_FILE` | `/run/opendkim/opendkim.pid` | PID file for reload |

### File Parsing

The library parses OpenDKIM's flat-file config format:

- **SigningTable** — maps from-patterns (e.g. `*@example.com`) to selector-domain keys (e.g. `mail._domainkey.example.com`)
- **KeyTable** — maps selector-domain keys to `domain:selector:/path/to/key.private` triples
- **TrustedHosts** — one IP, CIDR, or hostname per line

### Key Generation

RSA-2048 keys are generated using Node.js `crypto.generateKeyPairSync()`. No shell calls to `opendkim-genkey`. The generated DNS TXT value includes `v=DKIM1; h=sha256; k=rsa; p=...` matching the format `opendkim-genkey` produces.

KeyTable entries always use canonical `/etc/opendkim/...` paths regardless of the local `OPENDKIM_CONFIG_DIR` setting, so config files are deployment-ready.

### DNS Verification

`verifyDns()` performs a live `dns.resolveTxt()` lookup for `selector._domainkey.domain` and compares the returned public key against the one derived from the private key on disk. Possible statuses:

| Status | Meaning |
|--------|---------|
| `valid` | DNS record matches the key on disk |
| `mismatch` | DNS record exists but public key differs |
| `missing` | No TXT record found |
| `no_key` | No private key on disk to compare against |

## API Routes

All routes return JSON.

### Signing rules (`SigningTable`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rules/signing` | List signing rules with stable ids |
| `POST` | `/api/rules/signing` | Add a rule (`{ pattern, keyRef, position? }`) |
| `PATCH` | `/api/rules/signing` | Reorder rules (`{ order: id[] }`) |
| `GET` | `/api/rules/signing/[id]` | Fetch a single rule by id |
| `PUT` | `/api/rules/signing/[id]` | Edit a rule (`{ pattern, keyRef }`) |
| `DELETE` | `/api/rules/signing/[id]` | Delete a rule |

### Keys (`KeyTable`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/rules/keys` | List key table entries with stable ids |
| `GET` | `/api/rules/keys/[id]` | Entry + disk files + expected DNS + live verification |
| `POST` | `/api/keys/generate` | Regenerate a domain's keypair |

### Domains (high-level helper)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/domains` | List domains with DNS record templates |
| `POST` | `/api/domains` | Add domain (generates key, updates tables) |
| `DELETE` | `/api/domains` | Remove domain (`ruleId` optional — scopes delete to one signing rule) |

### DNS verification

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dns` | All domains with expected records + live verification |
| `GET` | `/api/dns?domain=x&selector=y` | Verify a single domain |

### Trusted hosts (`TrustedHosts`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/trusted-hosts` | List entries with stable ids |
| `POST` | `/api/trusted-hosts` | Add an entry (`{ value, position? }`) |
| `GET` | `/api/trusted-hosts/[id]` | Fetch a single entry by id |
| `PUT` | `/api/trusted-hosts/[id]` | Edit an entry (`{ value, inlineComment? }`) |
| `DELETE` | `/api/trusted-hosts/[id]` | Delete an entry |

### Config + service

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Read `opendkim.conf`, `SigningTable`, `KeyTable` |
| `POST` | `/api/service` | Send `SIGUSR1` to reload OpenDKIM |

### Error responses

Management routes return structured JSON errors:

| HTTP | `error` code | When |
|------|--------------|------|
| 400 | `VALIDATION_ERROR` | Missing or malformed request body |
| 404 | `NOT_FOUND` | Id does not resolve to an entry |
| 409 | `DUPLICATE_ENTRY` | Add would collide with an existing entry |
| 500 | `INTERNAL` | Anything else |

Body shape: `{ "error": "<code>", "message": "<human-readable>" }`.

## Docker Deployment

### Quick Start

```bash
# 1. Copy the example env file
cp .env.example .env

# 2. Find the opendkim user's UID/GID on the host
id opendkim
# e.g. uid=113(opendkim) gid=113(opendkim)

# 3. Edit .env and set APP_UID / APP_GID to match

# 4. Build and run
docker compose up -d
```

The dashboard is available at `http://<host>:3000`.

### UID/GID Matching

The container process must run as the same UID/GID as the host's `opendkim` user. This allows it to read private keys and write to `SigningTable`, `KeyTable`, etc. Set these in your `.env` file:

```env
APP_UID=113
APP_GID=113
```

Find the correct values with `id opendkim` on the host. Common defaults:

| Distro | Typical UID/GID |
|--------|-----------------|
| Debian / Ubuntu | 113 |
| RHEL / Rocky | 996 |
| Arch | 970 |

If the values don't match, the container will get permission errors reading/writing key files.

### Volume Mounts

| Host Path | Container Path | Mode | Purpose |
|-----------|---------------|------|---------|
| `/etc/opendkim` | `/data/opendkim` | read-write | Config files and keys |
| `/etc/opendkim.conf` | `/data/opendkim.conf` | read-only | Main config |
| `/run/opendkim` | `/data/run` | read-only | PID file for reload |

Host paths are mounted into `/data/` inside the container rather than system paths — the container has no reason to expose `/etc/` or `/run/`.

### Service Reload (SIGUSR1)

The reload button sends `SIGUSR1` to the host's OpenDKIM process via its PID file. This requires `pid: host` in `compose.yml`, which shares the host PID namespace with the container.

If you prefer not to grant this access, remove the `pid: host` line — everything else works without it, but reload must be done manually on the host:

```bash
systemctl reload opendkim
# or
kill -HUP $(cat /run/opendkim/opendkim.pid)
```

### Docker Environment Variables

All user-configurable settings are in `.env` (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_UID` | `113` | UID to run the container as (match host `opendkim` user) |
| `APP_GID` | `113` | GID to run the container as |
| `DASHBOARD_PORT` | `3000` | Host port to expose the dashboard on |
| `OPENDKIM_CONFIG_DIR` | `/etc/opendkim` | Host path to OpenDKIM config directory |
| `OPENDKIM_CONF` | `/etc/opendkim.conf` | Host path to `opendkim.conf` |
| `OPENDKIM_RUN_DIR` | `/run/opendkim` | Host path to OpenDKIM run directory (PID file) |

### Custom Port

```env
DASHBOARD_PORT=8080
```

### Behind a Reverse Proxy

If running behind nginx or similar, proxy to the container port:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Development

### Local Data Directory

The `data/` directory is gitignored and holds the OpenDKIM config tree the app reads and writes to. For local development, create it with the standard OpenDKIM file structure:

```
data/
├── opendkim.conf
└── opendkim/
    ├── KeyTable
    ├── SigningTable
    ├── TrustedHosts
    └── keys/
        └── <domain>/
            ├── mail.private
            └── mail.txt
```

Then point `.env.local` at it:

```env
OPENDKIM_CONFIG_DIR=./data/opendkim
OPENDKIM_CONF=./data/opendkim.conf
```

In production via Docker, the host's `/etc/opendkim` is mounted into the container at the same path — `data/` is not used.

### Adding a Domain (Flow)

1. User fills in domain, selector, and from-pattern
2. `POST /api/domains` calls `addDomain()` which:
   - Creates `keys/<domain>/` directory
   - Generates RSA-2048 keypair
   - Writes `<selector>.private` and `<selector>.txt`
   - Appends entries to `SigningTable` and `KeyTable`
3. UI displays the DNS TXT record to add
4. User adds TXT record to DNS
5. User clicks verify to confirm propagation
6. User clicks reload to pick up new config in OpenDKIM
