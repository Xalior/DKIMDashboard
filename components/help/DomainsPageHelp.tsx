import Link from 'next/link';

export default function DomainsPageHelp() {
  return (
    <>
      <p>
        The Domains page is the most common entry point for day-to-day DKIM admin. Adding a
        domain here does three things in one shot:
      </p>
      <ul>
        <li>Generates a new RSA-2048 key pair on disk.</li>
        <li>
          Adds a canonical <Link href="/rules/signing">signing rule</Link> (pattern →{' '}
          <code>selector._domainkey.domain</code>).
        </li>
        <li>
          Adds a matching <Link href="/keys">key entry</Link> so OpenDKIM can resolve that
          reference to the private key.
        </li>
      </ul>

      <h6>Each row is a signing rule, not a domain</h6>
      <p>
        The rows on this page are projected from SigningTable — so if you have <em>two</em> rules
        for the same <code>(domain, selector)</code> pair (for example a narrow pattern and a
        wider glob both pointing at the same key), you&apos;ll see two rows. Deleting one of them
        only removes that specific rule. The key entry and key files on disk stay in place until
        you remove the last rule that references them.
      </p>
      <p>
        For per-rule-level edits (renaming patterns, reordering, non-canonical shapes like
        cross-domain mappings), use{' '}
        <Link href="/rules/signing">Signing Rules</Link> instead.
      </p>

      <h6>DNS status column</h6>
      <p>
        The dashboard checks whether your <code>selector._domainkey.domain</code> TXT record
        matches the public key derived from the private key on disk. States:
      </p>
      <ul>
        <li>
          <strong>Verified</strong> — live DNS matches the on-disk key.
        </li>
        <li>
          <strong>Not in DNS</strong> — no TXT record at that name (publish the one from{' '}
          <em>View DNS record</em>).
        </li>
        <li>
          <strong>Mismatch</strong> — TXT record exists but doesn&apos;t match. Either update DNS
          or regenerate the key to match what&apos;s published.
        </li>
        <li>
          <strong>No key</strong> — no private key on disk to derive an expected value from
          (unusual; usually means a hand-edited KeyTable entry points at a missing file).
        </li>
      </ul>

      <h6>Key files on disk are never auto-deleted</h6>
      <p>
        Delete removes the signing rule (and, when it was the last one, the key entry) but leaves
        <code>.private</code> and <code>.txt</code> files under{' '}
        <code>keys/&lt;domain&gt;/</code> intact. Clear them by hand if you want the disk space
        back.
      </p>
    </>
  );
}
