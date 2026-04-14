'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Form,
  Modal,
  Spinner,
} from 'react-bootstrap';

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

interface TrustedHostEntry {
  id: string;
  value: string;
  isRefile: boolean;
  inlineComment?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Strip the leading '#' + optional whitespace from the stored inline
 * comment so the edit input shows the plain text body. The '#' is a
 * storage / serialization detail — the UI re-adds it on save.
 */
function commentBody(inlineComment: string | undefined): string {
  return inlineComment ? inlineComment.replace(/^#\s*/, '') : '';
}

export default function EditTrustedHostPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [entry, setEntry] = useState<TrustedHostEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [value, setValue] = useState('');
  const [inlineComment, setInlineComment] = useState('');
  const [hadInlineComment, setHadInlineComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/trusted-hosts/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (alive) setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { entry: TrustedHostEntry };
      })
      .then((body) => {
        if (!alive || !body) return;
        setEntry(body.entry);
        setValue(body.entry.value);
        setInlineComment(commentBody(body.entry.inlineComment));
        setHadInlineComment(body.entry.inlineComment !== undefined);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const trimmed = inlineComment.trim();
      // Three cases for inlineComment in the PUT body:
      //   - user entered text        → normalise (prepend '#' if missing), replace
      //   - user cleared a previous  → explicit empty string, drop
      //   - user had none and still  → omit key, preserve (which is no-op)
      const putBody: { value: string; inlineComment?: string } = { value };
      if (trimmed) {
        putBody.inlineComment = trimmed.startsWith('#') ? trimmed : `# ${trimmed}`;
      } else if (hadInlineComment) {
        putBody.inlineComment = '';
      }

      const res = await fetch(`/api/trusted-hosts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(putBody),
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        router.push('/trusted-hosts');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trusted-hosts/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.status === 404 || res.status === 204) {
        router.push('/trusted-hosts');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (notFound || !entry) {
    return (
      <Container className="py-4" style={{ maxWidth: '42rem' }}>
        <h2 className="mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>Trusted host not found
        </h2>
        <Alert variant="warning">
          No trusted host entry with id <code>{id}</code>. It may have been removed.
        </Alert>
        <Button variant="primary" onClick={() => router.push('/trusted-hosts')}>
          Back to Trusted Hosts
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: '42rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-pencil me-2"></i>Edit trusted host
            {entry.isRefile && (
              <Badge bg="info" className="ms-2">
                refile
              </Badge>
            )}
          </h2>
          <Link href="/trusted-hosts" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Trusted Hosts
          </Link>
        </div>
        <AboutThisPage title="Editing a trusted host">
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
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  pattern="[^\s,]+"
                  title="Single token — no whitespace or commas."
                  aria-describedby="value-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                No whitespace or commas in the value. Editing this entry generates a new id, so
                the URL will change after save.
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
                content="Inline comment carried through the edit. Clear to drop."
              >
                <Form.Control
                  id="inline-comment"
                  type="text"
                  value={inlineComment}
                  onChange={(e) => setInlineComment(e.target.value)}
                  aria-describedby="inline-comment-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                Clear this field to drop the inline comment. Leading <code>#</code> is added
                automatically if you omit it.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-between">
              <Button variant="outline-danger" onClick={() => setShowDelete(true)} disabled={saving}>
                <i className="bi bi-trash me-1"></i>Delete
              </Button>
              <div className="d-flex gap-2">
                <Button variant="secondary" onClick={() => router.push('/trusted-hosts')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving || !value.trim()}>
                  {saving ? (
                    <>
                      <Spinner size="sm" className="me-1" />
                      Saving…
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </div>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Modal show={showDelete} onHide={() => setShowDelete(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle text-danger me-2"></i>
            Delete this trusted host?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This removes the entry from TrustedHosts. Comments attached to it are removed too.</p>
          <pre className="p-2 bg-light rounded border mb-0">
            {entry.value}
            {entry.inlineComment ? ` ${entry.inlineComment}` : ''}
          </pre>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Spinner size="sm" className="me-1" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
