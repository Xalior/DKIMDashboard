# 🔐 DKIM Dashboard

> 🛡️ A web-based management interface for OpenDKIM — generate keys, manage domains, verify DNS, and keep your email signing infrastructure under control.

[![License: LGPL v3](https://img.shields.io/badge/License-LGPL_v3-blue.svg)](https://www.gnu.org/licenses/lgpl-3.0)

---

## ✨ Features

- 🌐 **Domain Management** — Add, remove, and view signing domains with their from-patterns and selectors
- 🔑 **Key Generation** — Pure TypeScript RSA-2048 key generation, no shell dependencies
- 📋 **DNS Record View** — See exactly what TXT record each domain needs
- ✅ **DNS Verification** — Live DNS lookups to validate your DKIM records match the keys on disk
- 👥 **Trusted Hosts** — Manage the hosts/networks allowed to send mail for signing
- ⚙️ **Config Viewer** — Read-only view of `opendkim.conf`, `SigningTable`, and `KeyTable`
- 🔄 **Service Reload** — Send SIGHUP to OpenDKIM to pick up config changes

## 🚀 Quick Start

```bash
git clone <repo-url>
cd DKIMDashboard
npm install
cp .env.example .env.local
```

Edit `.env.local` to point at your OpenDKIM configuration:

```env
OPENDKIM_CONFIG_DIR=./data/opendkim
OPENDKIM_CONF=./data/opendkim.conf
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

## 🐳 Production Deployment

For production, use Docker Compose with the host's live OpenDKIM config mounted in. See the full [Docker deployment guide](docs/README.md#docker-deployment) for UID/GID setup, volume mounts, service reload, and reverse proxy configuration.

```bash
cp .env.example .env
# Edit .env — set APP_UID/APP_GID to match your host's opendkim user
docker compose up -d
```

## ⚠️ Security Notice

This application has **no built-in authentication or access control**. All endpoints are unrestricted. Access management should be handled at your edge/ingress layer (e.g. nginx basic auth, reverse proxy IP allowlists, VPN, etc.). **Do not expose this application directly to the internet.**

## 📚 Documentation

Full [architecture, API reference, and development docs](docs/README.md).

## 📝 License

This project is licensed under the [GNU Lesser General Public License v3.0](LICENSE).
