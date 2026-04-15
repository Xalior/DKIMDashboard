export function PatternHelp() {
  return (
    <>
      <p>
        The pattern is matched against each outgoing message&apos;s envelope <em>From</em>
        address. OpenDKIM supports <code>*</code> as a wildcard for any number of characters.
      </p>
      <ul>
        <li>
          <code>*@example.com</code> — all mail from <code>example.com</code>
        </li>
        <li>
          <code>*@*.example.com</code> — all mail from any subdomain of <code>example.com</code>
        </li>
        <li>
          <code>alice@example.com</code> — just that one sender
        </li>
      </ul>
      <p>Patterns are evaluated top-to-bottom; the first match is used.</p>
    </>
  );
}

export function KeyRefHelp() {
  return (
    <>
      <p>
        The key reference is the name OpenDKIM looks up in <code>KeyTable</code> to find the
        actual private key on disk. Format: <code>selector._domainkey.domain</code>.
      </p>
      <p>
        Example: <code>mail._domainkey.example.com</code>. The matching KeyTable entry would
        typically read:
      </p>
      <pre className="p-2 bg-light rounded border">
        mail._domainkey.example.com example.com:mail:/etc/opendkim/keys/example.com/mail.private
      </pre>
      <p>
        The <em>key reference</em> also determines the DNS name where the matching public key is
        published — <code>selector._domainkey.domain</code> as a TXT record.
      </p>
    </>
  );
}

export function OrderHelp() {
  return (
    <>
      <p>
        OpenDKIM uses <strong>first-match-wins</strong> on SigningTable. The order of rules in
        this file is semantic, not cosmetic.
      </p>
      <p>
        Put your most specific patterns at the top, broader globs below. Otherwise a catch-all
        glob near the top will shadow any specific rules beneath it.
      </p>
    </>
  );
}

export function CrossDomainMappingHelp() {
  return (
    <>
      <p>
        A cross-domain mapping signs mail <em>as</em> a different domain than it was sent from.
        Typical use: a smarthost relay where mail originates from <code>ursa.xalior.com</code> but
        should appear to downstream mail servers as signed by <code>clientmail.xalior.com</code>.
      </p>
      <p>
        Example rule:{' '}
        <code>*@ursa.xalior.com mail._domainkey.clientmail.xalior.com</code>
      </p>
      <p>
        For cross-domain signing to pass DKIM verification, the public key must be published at
        the <em>key reference</em>&apos;s DNS name — <code>mail._domainkey.clientmail.xalior.com</code>{' '}
        in the example — and the mail&apos;s <em>From</em> or header-relevant domain must align
        with the signing domain per your DMARC policy.
      </p>
    </>
  );
}

export function RefileDirectiveHelp() {
  return (
    <>
      <p>
        <code>refile:/path/to/file</code> tells OpenDKIM to load additional rules from a separate
        file. It&apos;s preserved in this dashboard as a non-canonical line — the dashboard never
        writes these itself, but it won&apos;t remove any you add by hand.
      </p>
      <p>
        If you see a <code>refile:</code> entry in the list with a badge, you can safely leave it
        or edit the referenced file by hand. The dashboard surfaces the directive so you know
        there may be more rules OpenDKIM reads that aren&apos;t visible here.
      </p>
    </>
  );
}
