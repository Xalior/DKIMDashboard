export function SelectorDomainHelp() {
  return (
    <>
      <p>
        The <strong>selectorDomain</strong> is the first token on a KeyTable line — e.g.{' '}
        <code>mail._domainkey.example.com</code>. It&apos;s also the <em>key reference</em> that
        SigningTable rules point at, and the DNS name where the matching public key must be
        published as a TXT record.
      </p>
      <p>
        Format: <code>selector._domainkey.domain</code>. If the selector is <code>mail</code> and
        the domain is <code>example.com</code>, the selectorDomain is{' '}
        <code>mail._domainkey.example.com</code>.
      </p>
    </>
  );
}

export function DomainHelp() {
  return (
    <>
      <p>
        The <strong>domain</strong> is the first colon-separated segment of the value side —
        e.g. the <code>example.com</code> in{' '}
        <code>example.com:mail:/etc/opendkim/keys/example.com/mail.private</code>.
      </p>
      <p>
        OpenDKIM uses this as the <em>signing-domain</em> identifier (the <code>d=</code> tag in
        the DKIM-Signature header). For a cross-domain mapping — where mail originates from one
        domain but is signed as another — this is the domain it&apos;s signed as.
      </p>
    </>
  );
}

export function SelectorHelp() {
  return (
    <>
      <p>
        The <strong>selector</strong> is the second colon-separated segment — e.g. the{' '}
        <code>mail</code> in <code>example.com:mail:/etc/opendkim/keys/example.com/mail.private</code>.
      </p>
      <p>
        OpenDKIM uses this as the <em>s=</em> tag in the DKIM-Signature header. It&apos;s also
        the label used in the public-key DNS record&apos;s name
        (<code>selector._domainkey.domain</code>). Most installs use <code>mail</code> unless they
        need multiple simultaneously-valid keys.
      </p>
    </>
  );
}

export function KeyPathHelp() {
  return (
    <>
      <p>
        The <strong>keyPath</strong> is the third colon-separated segment — the absolute path to
        the private key file on disk inside the container. Typically{' '}
        <code>/etc/opendkim/keys/&lt;domain&gt;/&lt;selector&gt;.private</code>.
      </p>
      <p>
        Paths here are always written in terms of the container&apos;s view of the filesystem
        (where <code>/etc/opendkim</code> is the canonical config dir), not the host path that
        might be mounted in.
      </p>
    </>
  );
}

export function MalformedEntryHelp() {
  return (
    <>
      <p>
        A <strong>non-standard entry</strong> is a KeyTable line that doesn&apos;t parse as
        canonical <code>selectorDomain domain:selector:keyPath</code> — most commonly because the
        value side has fewer than three colon-separated segments, or because the line is a single
        token.
      </p>
      <p>
        The dashboard preserves these lines byte-for-byte on every write, so hand-maintained
        content stays intact. You can&apos;t edit them through the UI in this phase; the
        R/W editor for individual key entries is a separate, later PR.
      </p>
      <p>
        If an entry is malformed because of a genuine typo, the safest fix is to edit{' '}
        <code>/etc/opendkim/KeyTable</code> directly — the dashboard will round-trip your fix the
        next time it writes.
      </p>
    </>
  );
}
