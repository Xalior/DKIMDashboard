export function DomainFieldHelp() {
  return (
    <>
      <p>
        The <strong>domain</strong> is the mail domain you want to sign. Example:{' '}
        <code>example.com</code>.
      </p>
      <p>
        This controls three things at once: the <code>d=</code> tag in outgoing DKIM signatures,
        the directory layout on disk (<code>keys/&lt;domain&gt;/</code>), and the DNS name where
        the public key is published (<code>selector._domainkey.domain</code>).
      </p>
      <p>
        If you want mail <em>sent from</em> one domain to be signed <em>as</em> a different
        domain (smarthost / cross-domain mapping), use{' '}
        <em>Signing Rules → Add Rule</em> — the Add Domain flow here is for the common 1:1 case.
      </p>
    </>
  );
}

export function FromPatternHelp() {
  return (
    <>
      <p>
        The <strong>from-pattern</strong> tells OpenDKIM which outgoing messages to sign with
        this key. Matched against the envelope-From address.
      </p>
      <ul>
        <li>
          <code>*@example.com</code> — all mail from <code>example.com</code>
        </li>
        <li>
          <code>*@*.example.com</code> — any subdomain of <code>example.com</code>
        </li>
        <li>
          <code>alice@example.com</code> — one specific sender
        </li>
      </ul>
      <p>
        The Add Domain form defaults to <code>*@&lt;domain&gt;</code>, which matches everything
        from that domain. Change it if you want a narrower or broader match.
      </p>
    </>
  );
}

export function SelectorFieldHelp() {
  return (
    <>
      <p>
        The <strong>selector</strong> labels this specific key. It appears in the DNS name
        (<code>selector._domainkey.domain</code>) and in the <code>s=</code> tag of the
        DKIM-Signature header.
      </p>
      <p>
        Most installs use <code>mail</code>. Use a different selector when you need two keys
        simultaneously valid — e.g. during a rotation where the old selector still has live mail
        in flight.
      </p>
    </>
  );
}

export function DnsStatusHelp() {
  return (
    <>
      <p>The DNS column reports the live state of the domain&apos;s public-key TXT record:</p>
      <ul>
        <li>
          <strong>Verified</strong> — live DNS TXT matches the private key on disk.
        </li>
        <li>
          <strong>Not in DNS</strong> — no TXT record was found at{' '}
          <code>selector._domainkey.domain</code>. Publish the record shown in{' '}
          <em>View DNS record</em>.
        </li>
        <li>
          <strong>Mismatch</strong> — a TXT record exists but the public key inside it
          doesn&apos;t match the private key on disk. Either update DNS, or regenerate the key
          from the Keys page to match what&apos;s published.
        </li>
        <li>
          <strong>No key</strong> — no private key on disk, so nothing to derive an expected
          value from.
        </li>
      </ul>
      <p>
        Use the search / refresh icon on each row to re-run DNS verification after making a
        change.
      </p>
    </>
  );
}
