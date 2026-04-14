import { RefileDirectiveHelp as SigningRefileDirectiveHelp } from './SigningRulesAtoms';

export function IpHelp() {
  return (
    <>
      <p>
        A literal IP address — IPv4 (<code>127.0.0.1</code>) or IPv6 (<code>::1</code>,{' '}
        <code>2001:db8::1</code>). OpenDKIM matches exact addresses only; for a subnet, use a
        CIDR range instead.
      </p>
    </>
  );
}

export function CidrHelp() {
  return (
    <>
      <p>
        A CIDR range — IPv4 (<code>10.0.0.0/8</code>, <code>192.168.1.0/24</code>) or IPv6
        (<code>2001:db8::/32</code>). Matches every address inside the range.
      </p>
      <p>
        Use <code>0.0.0.0/0</code> for &ldquo;trust everything&rdquo; — the
        opendkim-default-open stance.
      </p>
    </>
  );
}

export function HostnameHelp() {
  return (
    <>
      <p>
        A hostname like <code>mail.example.com</code>. OpenDKIM resolves the name at reload and
        matches against the address(es) it returns. If the name resolves to multiple addresses,
        all of them are trusted.
      </p>
      <p>
        Hostnames are <em>not</em> re-resolved per-message, so DNS changes only take effect on
        the next OpenDKIM reload.
      </p>
    </>
  );
}

export function InlineCommentHelp() {
  return (
    <>
      <p>
        Trailing <code>#…</code> on an entry is captured as an inline comment. Useful for noting
        what a CIDR range covers, who owns a host, or why an entry is here.
      </p>
      <p>
        Inline comments are preserved byte-for-byte on untouched lines <em>and</em> carried
        through when you edit an entry — so operator context never gets silently dropped. If you
        ever want to drop the comment, the edit form has a &ldquo;Clear inline comment&rdquo;
        control for that.
      </p>
    </>
  );
}

// Re-exported from the signing-rules atoms — the refile: directive semantics
// are identical in both contexts, so DRY.
export const RefileDirectiveHelp = SigningRefileDirectiveHelp;
