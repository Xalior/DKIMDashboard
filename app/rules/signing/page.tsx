'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Container,
  Modal,
  Spinner,
  Table,
} from 'react-bootstrap';

import AboutThisPage from '@/components/AboutThisPage';
import RowHelp from '@/components/RowHelp';
import SigningRulesPageHelp from '@/components/help/SigningRulesPageHelp';
import {
  CrossDomainMappingHelp,
  OrderHelp,
  PatternHelp,
  RefileDirectiveHelp,
} from '@/components/help/SigningRulesAtoms';

interface SigningRule {
  id: string;
  pattern: string;
  keyRef: string;
}

export default function SigningRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<SigningRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<SigningRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [reordering, setReordering] = useState(false);

  const fetchRules = useCallback(() => {
    setLoading(true);
    fetch('/api/rules/signing')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as SigningRule[];
      })
      .then(setRules)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const persistOrder = async (order: string[]) => {
    setReordering(true);
    setError(null);
    try {
      const res = await fetch('/api/rules/signing', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ order }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { rules: SigningRule[] };
      setRules(body.rules);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReordering(false);
    }
  };

  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    const next = rules.slice();
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRules(next);
    void persistOrder(next.map((r) => r.id));
  };

  const moveDown = (idx: number) => {
    if (idx >= rules.length - 1) return;
    const next = rules.slice();
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setRules(next);
    void persistOrder(next.map((r) => r.id));
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/rules/signing/${encodeURIComponent(showDelete.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setShowDelete(null);
      fetchRules();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-list-ul me-2"></i>Signing Rules
          </h2>
          <Link href="/domains" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Domains
          </Link>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <AboutThisPage title="About the Signing Rules page">
            <SigningRulesPageHelp />
          </AboutThisPage>
          <Button variant="outline-secondary" onClick={fetchRules} disabled={reordering}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </Button>
          <Button variant="primary" onClick={() => router.push('/rules/signing/new')}>
            <i className="bi bi-plus-circle me-1"></i>Add Rule
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: '6rem' }}>Order</th>
                <th>
                  Pattern
                  <RowHelp title="Pattern">
                    <PatternHelp />
                    <hr />
                    <CrossDomainMappingHelp />
                  </RowHelp>
                </th>
                <th>
                  Key reference
                  <RowHelp title="Key reference">
                    <RefileDirectiveHelp />
                  </RowHelp>
                </th>
                <th style={{ width: '14rem' }} className="text-end">
                  <span className="me-1">Actions</span>
                  <RowHelp title="Order matters">
                    <OrderHelp />
                  </RowHelp>
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r, idx) => {
                const isMalformed = r.keyRef === '';
                return (
                  <tr key={r.id}>
                    <td>
                      <ButtonGroup size="sm">
                        <Button
                          variant="outline-secondary"
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0 || reordering}
                          aria-label="Move up"
                          title="Move up"
                        >
                          <i className="bi bi-arrow-up"></i>
                        </Button>
                        <Button variant="outline-secondary" disabled>
                          {idx + 1}
                        </Button>
                        <Button
                          variant="outline-secondary"
                          onClick={() => moveDown(idx)}
                          disabled={idx === rules.length - 1 || reordering}
                          aria-label="Move down"
                          title="Move down"
                        >
                          <i className="bi bi-arrow-down"></i>
                        </Button>
                      </ButtonGroup>
                    </td>
                    <td>
                      <code>{r.pattern}</code>
                      {isMalformed && (
                        <Badge bg="warning" text="dark" className="ms-2">
                          non-standard
                        </Badge>
                      )}
                    </td>
                    <td>
                      {r.keyRef ? (
                        <code>{r.keyRef}</code>
                      ) : (
                        <span className="text-muted fst-italic">(none — raw line preserved)</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-1"
                        title="Edit rule"
                        onClick={() => router.push(`/rules/signing/${encodeURIComponent(r.id)}`)}
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        title="Delete rule"
                        onClick={() => setShowDelete(r)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    No signing rules configured. Click &quot;Add Rule&quot; to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!showDelete} onHide={() => setShowDelete(null)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-exclamation-triangle text-danger me-2"></i>
            Delete signing rule
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Delete this rule?</p>
          <pre className="p-2 bg-light rounded border mb-0">
            {showDelete?.pattern} {showDelete?.keyRef}
          </pre>
          <p className="text-muted small mt-2 mb-0">
            Comments and blank lines attached to this rule will be removed with it. Other rules
            are unaffected.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
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
