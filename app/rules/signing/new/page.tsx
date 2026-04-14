'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Container, Form, Spinner } from 'react-bootstrap';

import AboutThisPage from '@/components/AboutThisPage';
import FieldTooltip from '@/components/FieldTooltip';
import RowHelp from '@/components/RowHelp';
import { CrossDomainMappingHelp, KeyRefHelp, PatternHelp } from '@/components/help/SigningRulesAtoms';

export default function NewSigningRulePage() {
  const router = useRouter();
  const [pattern, setPattern] = useState('');
  const [keyRef, setKeyRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rules/signing', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pattern, keyRef }),
      });
      if (res.status === 201) {
        router.push('/rules/signing');
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(body.message ?? `HTTP ${res.status}`);
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
            <i className="bi bi-plus-circle me-2"></i>Add signing rule
          </h2>
          <Link href="/rules/signing" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to signing rules
          </Link>
        </div>
        <AboutThisPage title="Adding a signing rule">
          <p>
            A signing rule pairs a <em>match pattern</em> with a <em>key reference</em>. OpenDKIM
            applies rules top-to-bottom and uses the first one that matches an outgoing message.
          </p>
          <p>
            For a standard domain-to-its-own-key rule, the Add Domain flow on the Domains page is
            usually easier — it creates the key pair and DNS record at the same time. Use this
            form when you need a non-standard shape: a glob pattern, or a cross-domain mapping
            where one sending domain should be signed as a different key domain (smarthost).
          </p>
          <CrossDomainMappingHelp />
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
                content="Sender-address pattern. Supports * as wildcard — e.g. *@example.com"
              >
                <Form.Control
                  id="pattern"
                  type="text"
                  placeholder="*@example.com"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  required
                  aria-describedby="pattern-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                Matched against the outgoing message&apos;s envelope From address.
              </Form.Text>
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
                  placeholder="mail._domainkey.example.com"
                  value={keyRef}
                  onChange={(e) => setKeyRef(e.target.value)}
                  required
                  aria-describedby="keyref-tooltip"
                  autoComplete="off"
                />
              </FieldTooltip>
              <Form.Text className="text-muted">
                Must already exist in KeyTable. Format: <code>selector._domainkey.domain</code>.
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => router.push('/rules/signing')}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting || !pattern || !keyRef}>
                {submitting ? (
                  <>
                    <Spinner size="sm" className="me-1" />
                    Adding…
                  </>
                ) : (
                  'Add rule'
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
