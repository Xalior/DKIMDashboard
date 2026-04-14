# Pre-Plan: Cross-domain SigningTable entries in DKIM Dashboard

**Status:** Ready for plan

## Goal

Make "signing rules" a first-class, independently-addressable concept in the dashboard: a rule is a (match-pattern, `selector._domainkey.domain`) tuple, not a side-effect of adding a domain. The existing Add-Domain flow continues to create its 1:1 rule under the hood, but rules can also be added, edited, and removed directly — including non-canonical shapes like a glob (`*@*.xalior.com`) or a cross-domain mapping (`*@ursa.xalior.com  mail._domainkey.clientmail.xalior.com`).

This choice (over a narrower smarthost-only feature) is driven by the data-loss problem: the current parser silently discards any line that doesn't fit its canonical shape on the next write. Treating rules as first-class is the level at which the parser can safely round-trip arbitrary entries.

Originating use case: smarthost / fleet pattern — one central signing identity (`clientmail.xalior.com`) covers mail originating from many sender domains (`ursa.xalior.com`, future `host2.xalior.com`, …). But the feature generalises.

## Scope (in)

- First-class **signing rules** in the data model and UI: add / edit / remove rules as (match-pattern, `selector._domainkey.domain`) tuples, independent of the Add-Domain bundle. Non-canonical shapes (globs, cross-domain mappings) are preserved round-trip.
- Same treatment for **KeyTable**: key entries are first-class, arbitrary-shape-tolerant, round-trip-safe. This closes the silent-data-loss hole on both tables.
- Same treatment for **TrustedHosts**: parser preserves arbitrary entries (including comments and `refile:` patterns), round-trip-safe. "The dashboard never destroys what you wrote by hand" becomes a property that holds across all three config files.
- **Help on every app screen**, three distinct surfaces, all opt-in (never permanent visual clutter):
  - **"About this page" button** → modal with authored static HTML. Page-scoped, **level-3** depth: DKIM 101 honed to that specific view, terminology used on that page.
  - **[?] icon next to each logical row** in the form editor (logical row, not necessarily an HTML `<tr>` — wherever an atomic piece of information is surfaced in the UI). Click opens a modal showing focused **level-2** help for that specific atom. Possibly shares the modal component with "About this page" — tech choice deliberately open, the commitment is at the human level: same *kind* of reading surface, different *scope* (page vs. row/atom).
  - **Field-level tooltips** on individual inputs (hover-revealed). Kept because they're non-intrusive *and* serve an accessibility role — screen readers surface them via ARIA, and they rescue users who'd otherwise have no idea what a field wants.
  - Level-2 content covers cross-app integration concerns (e.g. "the TXT record your DNS provider will ask for": GoDaddy, Cloudflare, Route53 all use different field names — we stay generic rather than branching per-provider).

## Scope (out)

The following are deliberately excluded from this piece of work, to be reconsidered individually as separate initiatives if/when needed:

- **Per-DNS-provider help** (Cloudflare / Route53 / GoDaddy / etc. specific copy). Generic integration help only.
- **Authentication / authorization** inside the dashboard. Edge ingress remains the gate.
- **DMARC / SPF record management**.
- **Key rotation / scheduled regeneration**.
- **i18n** of help content. English only.
- **Change history / audit log** of edits.
- **Import flow** for opendkim installs that already have non-canonical entries. Current install on ursa is all-canonical, so not a live problem. New parser will read non-canonical content faithfully once it ships, so the "import flow" question only matters if someone wants a dedicated UX around it — not required for correctness.

## Concept

**Vertical slice, bottom-up, anchored to the user's mental entry point.** The canonical user journey is "I want my email to work for *my domain*" — so the Domains screen stays primary. A new user arrives, picks Add Domain, gets a key and a canonical 1:1 rule, publishes the TXT, they're done.

Signing rules are first-class *in the model* (the store, the parser, the writer) but surfaced in the UI as advanced detail — either expanded inline under the parent domain or on a dedicated "signing rules" screen reached from Domains. They're not in the newcomer's face. Users graduate to them when a legitimate need shows up (smarthost, glob, cross-domain mapping). The help copy teaches this progression rather than front-loading all of DKIM at once.

**Rule ordering**: OpenDKIM's SigningTable is order-sensitive (first match wins). The Domains screen behaves as if ordering doesn't exist, because for 1:1 canonical rules it doesn't. The advanced rules editor *does* expose ordering (drag / up-down / reorder) because overlapping rules — specific + wildcard, or specific + catch-all — exist in the real world for reasons we may not predict up front (decision recorded acknowledging we don't fully anticipate the "weird" cases; exposing order avoids painting ourselves into a corner).

**Editor shape**: form-with-fields, click-through to edit individual entries. Modal editors are acceptable *only* if they remain deep-linkable — sharing a URL must be able to land a reader directly on a specific leaf in its edit state. (Implication worth carrying into plan phase: edit state is part of the route / URL, not purely ephemeral component state.) No free-text / raw-file editor.

## Current state (investigation findings, not specification)

- `lib/opendkim.ts` parses SigningTable and KeyTable with a strict canonical shape: `*@<domain>  selector._domainkey.<domain>`.
- Any line outside that shape (`refile:`, glob wildcard, regex, or simply a pattern whose selector doesn't match the domain) is **silently discarded** on the next write, because writes are reconstructed from the parsed model, not round-tripped.
- The app's `DomainEntry` model bundles (pattern + selector + key path + DNS record) as one monolithic unit. There is no separate concept of a signing *rule* independent of a key.
- Consequence: the smarthost mapping (`*@ursa.xalior.com  mail._domainkey.clientmail.xalior.com`) cannot be added via the current UI and cannot safely be added by hand either.
