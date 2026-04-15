import Link from 'next/link';

export default function KeyEntriesPageHelp() {
  return (
    <>
      <p>
        A <strong>key entry</strong> tells OpenDKIM where to find the private signing key for a
        given <em>selectorDomain</em> (e.g. <code>mail._domainkey.example.com</code>). Each entry
        lives in <code>/etc/opendkim/KeyTable</code> on the line:
      </p>
      <pre className="p-2 bg-light rounded border">
        selector._domainkey.domain domain:selector:/path/to/key.private
      </pre>

      <h6>Relationship to signing rules</h6>
      <p>
        When a <Link href="/rules/signing">signing rule</Link> matches an outgoing message, its{' '}
        <em>key reference</em> (e.g. <code>mail._domainkey.example.com</code>) is looked up here
        to find the actual private key. A signing rule that points at a
        selectorDomain not present in KeyTable will fail to sign the message.
      </p>
      <p>
        (Hint: if you&apos;re wondering why a rule isn&apos;t working, compare the rule&apos;s key
        reference to the entries on this page.)
      </p>

      <h6>Why order doesn&apos;t matter</h6>
      <p>
        KeyTable is a lookup map keyed by selectorDomain. OpenDKIM takes the <em>first</em> entry
        matching the key reference, so duplicate selectorDomain values are a footgun — the second
        becomes dead code. The dashboard refuses to create duplicate selectorDomain entries.
      </p>

      <h6>Non-standard rows</h6>
      <p>
        Lines that don&apos;t parse as <code>selectorDomain domain:selector:keyPath</code> are
        preserved byte-for-byte and shown with a <em>non-standard entry</em> badge. The dashboard
        doesn&apos;t write malformed rows itself, but it won&apos;t silently remove ones you add
        by hand either — useful if you maintain the file alongside the UI.
      </p>

      <h6>This page is read-only (for now)</h6>
      <p>
        Phase 2 surfaces every KeyTable entry — including malformed ones the old{' '}
        <code>/keys</code> page couldn&apos;t see — but doesn&apos;t yet expose add/edit/delete
        for individual key entries. Adding a domain via <em>Domains → Add Domain</em> still
        creates a key + KeyTable entry in one go, and <em>Regenerate</em> still works for
        canonical rows.
      </p>
    </>
  );
}
