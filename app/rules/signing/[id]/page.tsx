'use client';

import { FormEvent, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Container, Form, Modal, Spinner } from 'react-bootstrap';

import AboutThisPage from '@/components/AboutThisPage';
import FieldTooltip from '@/components/FieldTooltip';
import RowHelp from '@/components/RowHelp';
import SigningRulesPageHelp from '@/components/help/SigningRulesPageHelp';
import { KeyRefHelp, PatternHelp } from '@/components/help/SigningRulesAtoms';

interface SigningRule {
  id: string;
  pattern: string;
  keyRef: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditSigningRulePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [rule, setRule] = useState<SigningRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pattern, setPattern] = useState('');
  const [keyRef, setKeyRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/rules/signing/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (alive) setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { rule: SigningRule };
      })
      .then((body) => {
        if (!alive || !body) return;
        setRule(body.rule);
        setPattern(body.rule.pattern);
        setKeyRef(body.rule.keyRef);
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
      const res = await fetch(`/api/rules/signing/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pattern, keyRef }),
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        router.push('/rules/signing');
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
      const res = await fetch(`/api/rules/signing/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.status === 404 || res.status === 204) {
        router.push('/rules/signing');
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

  if (notFound || !rule) {
    return (
      <Container className="py-4" style={{ maxWidth: '42rem' }}>
        <h2 className="mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>Rule not found
        </h2>
        <Alert variant="warning">
          The signing rule with id <code>{id}</code> no longer exists. It may have been deleted or
          edited in another tab.
        </Alert>
        <Button variant="primary" onClick={() => router.push('/rules/signing')}>
          Back to signing rules
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-4" style={{ maxWidth: '42rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-pencil me-2"></i>Edit signing rule
          </h2>
          <Link href="/rules/signing" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to signing rules
          </Link>
        </div>
        <AboutThisPage title="Editing a signing rule">
          <SigningRulesPageHelp />
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
              <Form.Label htmlFor="pattern">
                Pattern
                <RowHelp title="Pattern">
                  <PatternHelp />
                </RowHelp>
              </Form.Label>
              <FieldTooltip
                id="pattern-tooltip"
                content="Sender-address pattern. Supports * as wildcard."
              >
                <Form.Control
                  id="pattern"
                  type="text"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  required
                  aria-describedby="pattern-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label htmlFor="keyRef">
                Key reference
                <RowHelp title="Key reference">
                  <KeyRefHelp />
                </RowHelp>
              </Form.Label>
              <FieldTooltip
                id="keyref-tooltip"
                content="selector._domainkey.domain — resolved via KeyTable to the private key on disk"
              >
                <Form.Control
                  id="keyRef"
                  type="text"
                  value={keyRef}
                  onChange={(e) => setKeyRef(e.target.value)}
                  required
                  aria-describedby="keyref-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                Editing this rule generates a new id, so the URL will change after save.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-between">
              <Button variant="outline-danger" onClick={() => setShowDelete(true)} disabled={saving}>
                <i className="bi bi-trash me-1"></i>Delete
              </Button>
              <div className="d-flex gap-2">
                <Button variant="secondary" onClick={() => router.push('/rules/signing')}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving || !pattern || !keyRef}>
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
            Delete this rule?
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This removes the rule from SigningTable. Comments attached to it are removed too.</p>
          <pre className="p-2 bg-light rounded border mb-0">
            {rule.pattern} {rule.keyRef}
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
