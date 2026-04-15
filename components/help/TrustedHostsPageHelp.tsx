export default function TrustedHostsPageHelp() {
  return (
    <>
      <p>
        The <strong>Trusted Hosts</strong> list controls which hosts and networks OpenDKIM will
        sign outgoing mail for, and which hosts it considers internal. It lives at{' '}
        <code>/etc/opendkim/TrustedHosts</code> as a plain list — one entry per line.
      </p>

      <h6>What each entry can be</h6>
      <ul>
        <li>
          An <strong>IP address</strong> — e.g. <code>127.0.0.1</code> or <code>::1</code>.
        </li>
        <li>
          A <strong>CIDR range</strong> — e.g. <code>10.0.0.0/8</code> or{' '}
          <code>192.168.1.0/24</code>.
        </li>
        <li>
          A <strong>hostname</strong> — e.g. <code>mail.example.com</code>. Resolved at
          OpenDKIM reload, not on every message.
        </li>
        <li>
          A <strong>refile: directive</strong> — e.g. <code>refile:/etc/opendkim/IgnoreHosts</code>.
          Tells OpenDKIM to read more entries from the referenced file. Preserved byte-for-byte
          by the dashboard and surfaced with a badge in the list.
        </li>
      </ul>

      <h6>How OpenDKIM uses this list</h6>
      <p>
        The dashboard&apos;s <code>opendkim.conf</code> points <code>ExternalIgnoreList</code>{' '}
        and <code>InternalHosts</code> at this same file, so an entry here serves <em>both</em>
        roles: mail from these hosts is signed (they&apos;re &ldquo;internal&rdquo;) and
        they&apos;re skipped for the &ldquo;is this mail from an untrusted host?&rdquo; check
        (they&apos;re &ldquo;ignored from external checks&rdquo;). In practice, most operators
        treat this as &ldquo;hosts allowed to submit mail for signing&rdquo;.
      </p>

      <h6>Order doesn&apos;t matter</h6>
      <p>
        TrustedHosts is a set, not an ordered list. The dashboard doesn&apos;t offer reorder
        controls for that reason. Entries can appear in any order and OpenDKIM will read them
        all.
      </p>

      <h6>Inline and block comments survive</h6>
      <p>
        Comment lines (starting with <code>#</code>) are preserved attached to the entry that
        follows them. Inline trailing comments on an entry (e.g.{' '}
        <code>192.168.1.0/24 # office</code>) are preserved on round-trip <em>and</em> carried
        through when you edit the entry. Use comments liberally — they survive.
      </p>

      <h6>Hand-edits are respected</h6>
      <p>
        You can maintain this file by hand alongside the UI. Any entry, comment, blank line, or
        <code>refile:</code> directive you add will survive the dashboard&apos;s next write.
      </p>
    </>
  );
}
