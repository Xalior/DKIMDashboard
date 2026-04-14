export default function SigningRulesPageHelp() {
  return (
    <>
      <p>
        A <strong>signing rule</strong> tells OpenDKIM which outgoing messages to sign, and which
        key to sign them with. Each rule is a pair: a <em>match pattern</em> and a <em>key
        reference</em>.
      </p>

      <h6>How it maps to the file</h6>
      <p>
        Rules live in <code>/etc/opendkim/SigningTable</code>. OpenDKIM matches each message&apos;s
        envelope address against the pattern on each line, <em>top-to-bottom</em>, and uses the
        first match. The key reference (<code>selector._domainkey.domain</code>) is then resolved
        via <code>KeyTable</code> to find the actual private key on disk.
      </p>

      <h6>Why the order matters</h6>
      <p>
        First-match-wins. A specific pattern placed below a broader glob will never fire. Use the
        up / down arrows to reorder; the file on disk is rewritten atomically to match.
      </p>

      <h6>Cross-domain and glob patterns</h6>
      <p>
        Patterns are not restricted to a single sending domain. You can:
      </p>
      <ul>
        <li>
          <strong>Cross-domain map</strong> — e.g. <code>*@ursa.xalior.com</code> →{' '}
          <code>mail._domainkey.clientmail.xalior.com</code>. Mail sent from <code>ursa</code> is
          signed <em>as</em> <code>clientmail.xalior.com</code>. The public key must be published
          at the <em>key reference</em>&apos;s DNS name, not the sending domain.
        </li>
        <li>
          <strong>Globs</strong> — e.g. <code>*@*.xalior.com</code> catches all subdomains.
        </li>
      </ul>

      <h6>After you change anything</h6>
      <p>
        OpenDKIM reads SigningTable on reload. Head to the Config page and hit{' '}
        <em>Reload Service</em> for the change to take effect. For new key references, also make
        sure the matching DNS TXT record is published — verify via the Domains page.
      </p>

      <h6>Hand-edits survive</h6>
      <p>
        The dashboard preserves comments, blank lines, and non-standard lines
        (e.g. <code>refile:</code> directives) across its own writes. You can maintain the file by
        hand alongside the UI without risk of the dashboard clobbering your notes.
      </p>
    </>
  );
}
