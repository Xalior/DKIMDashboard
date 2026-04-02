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

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An OpenDKIM installation (or the example data for development)

### Installation

```bash
git clone <repo-url>
cd DKIMDashboard
npm install
```

### ⚙️ Configuration

Copy the example env file and adjust paths:

```bash
cp .env.example .env.local
```

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENDKIM_CONFIG_DIR` | Path to OpenDKIM config directory (contains `KeyTable`, `SigningTable`, `TrustedHosts`, `keys/`) | `/etc/opendkim` |
| `OPENDKIM_CONF` | Path to `opendkim.conf` | `/etc/opendkim.conf` |
| `OPENDKIM_PID_FILE` | Path to OpenDKIM PID file (for reload) | `/run/opendkim/opendkim.pid` |

For local development, point these at the included example data:

```env
OPENDKIM_CONFIG_DIR=./data/etc/opendkim
OPENDKIM_CONF=./data/etc/opendkim.conf
```

### 🏃 Running

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

## 📚 Documentation

Full architecture, API reference, and development docs are in [docs/](docs/README.md).

## 📝 License

This project is licensed under the [GNU Lesser General Public License v3.0](LICENSE).
