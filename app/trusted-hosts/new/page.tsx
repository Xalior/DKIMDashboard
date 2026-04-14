'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';

import AboutThisPage from '@/components/AboutThisPage';
import FieldTooltip from '@/components/FieldTooltip';
import RowHelp from '@/components/RowHelp';
import TrustedHostsPageHelp from '@/components/help/TrustedHostsPageHelp';
import {
  CidrHelp,
  HostnameHelp,
  InlineCommentHelp,
  IpHelp,
  RefileDirectiveHelp,
} from '@/components/help/TrustedHostsAtoms';

export default function NewTrustedHostPage() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [inlineComment, setInlineComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmedComment = inlineComment.trim();
      // If the user typed a comment without the leading '#', add it; empty
      // string stays as "no inline comment".
      const normalizedComment = trimmedComment
        ? trimmedComment.startsWith('#')
          ? trimmedComment
          : `# ${trimmedComment}`
        : undefined;

      // The POST endpoint doesn't accept inlineComment on create (create is
      // just value + optional position). If the user wants a comment on a
      // brand-new entry, we POST first then PUT the new entry's id with the
      // comment — simpler than plumbing inlineComment through create.
      const createRes = await fetch('/api/trusted-hosts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (createRes.status !== 201) {
        const body = (await createRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${createRes.status}`);
      }

      if (normalizedComment !== undefined) {
        const body = (await createRes.json()) as { entry: { id: string } };
        const putRes = await fetch(`/api/trusted-hosts/${encodeURIComponent(body.entry.id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ value, inlineComment: normalizedComment }),
        });
        if (!putRes.ok) {
          const putBody = (await putRes.json().catch(() => ({}))) as { message?: string };
          throw new Error(putBody.message ?? `HTTP ${putRes.status}`);
        }
      }

      router.push('/trusted-hosts');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-4" style={{ maxWidth: '42rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-plus-circle me-2"></i>Add trusted host
          </h2>
          <Link href="/trusted-hosts" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Trusted Hosts
          </Link>
        </div>
        <AboutThisPage title="Adding a trusted host">
          <TrustedHostsPageHelp />
        </AboutThisPage>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Body>
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label htmlFor="value">
                Value
                <RowHelp title="IP / CIDR / hostname / refile:">
                  <IpHelp />
                  <hr />
                  <CidrHelp />
                  <hr />
                  <HostnameHelp />
                  <hr />
                  <RefileDirectiveHelp />
                </RowHelp>
              </Form.Label>
              <FieldTooltip
                id="value-tooltip"
                content="IP, CIDR range, hostname, or refile:/path/to/file"
              >
                <Form.Control
                  id="value"
                  type="text"
                  placeholder="127.0.0.1   or   10.0.0.0/8   or   mail.example.com   or   refile:/etc/opendkim/IgnoreHosts"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  pattern="[^\s,]+"
                  title="Single token — no whitespace or commas. Add multiple entries one at a time."
                  aria-describedby="value-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                One entry per line on disk. No whitespace or commas in the value — add multiple
                entries one at a time. Duplicates are rejected.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label htmlFor="inline-comment">
                Inline comment <span className="text-muted small">(optional)</span>
                <RowHelp title="Inline comments">
                  <InlineCommentHelp />
                </RowHelp>
              </Form.Label>
              <FieldTooltip
                id="inline-comment-tooltip"
                content="Short note appended to the line. A leading # is added if you omit it."
              >
                <Form.Control
                  id="inline-comment"
                  type="text"
                  placeholder="office network"
                  value={inlineComment}
                  onChange={(e) => setInlineComment(e.target.value)}
                  aria-describedby="inline-comment-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                Preserved on edit and round-trip. A leading <code>#</code> is added automatically
                if you omit it.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => router.push('/trusted-hosts')}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !value.trim()}>
                {submitting ? (
                  <>
                    <Spinner size="sm" className="me-1" />
                    Adding…
                  </>
                ) : (
                  'Add trusted host'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
