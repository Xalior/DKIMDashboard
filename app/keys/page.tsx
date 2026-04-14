'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Modal,
  Spinner,
  Table,
} from 'react-bootstrap';

import AboutThisPage from '@/components/AboutThisPage';
import RowHelp from '@/components/RowHelp';
import KeyEntriesPageHelp from '@/components/help/KeyEntriesPageHelp';
import {
  DomainHelp,
  KeyPathHelp,
  MalformedEntryHelp,
  SelectorDomainHelp,
  SelectorHelp,
} from '@/components/help/KeyEntriesAtoms';

interface KeyEntry {
  id: string;
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
  malformed: boolean;
  rawLine: string;
}

export default function KeysPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<KeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<KeyEntry | null>(null);
  const [regenResult, setRegenResult] = useState<{ dnsRecord: string; bindRecord: string } | null>(null);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    fetch('/api/rules/keys')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as KeyEntry[];
      })
      .then(setEntries)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleRegenerate = async () => {
    if (!showConfirm || showConfirm.malformed) return;
    setRegenerating(showConfirm.id);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: showConfirm.domain, selector: showConfirm.selector }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRegenResult(data);
      fetchEntries();
    } catch (err) {
      setError(String(err));
      setShowConfirm(null);
    } finally {
      setRegenerating(null);
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
        <h2 className="mb-0">
          <i className="bi bi-key me-2"></i>Keys
        </h2>
        <div className="d-flex gap-2 align-items-center">
          <AboutThisPage title="About the Keys page">
            <KeyEntriesPageHelp />
          </AboutThisPage>
          <Button variant="outline-secondary" onClick={fetchEntries}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
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
                <th>
                  selectorDomain
                  <RowHelp title="selectorDomain">
                    <SelectorDomainHelp />
                  </RowHelp>
                </th>
                <th>
                  Domain
                  <RowHelp title="Domain">
                    <DomainHelp />
                  </RowHelp>
                </th>
                <th>
                  Selector
                  <RowHelp title="Selector">
                    <SelectorHelp />
                  </RowHelp>
                </th>
                <th>
                  Key path
                  <RowHelp title="Key path">
                    <KeyPathHelp />
                  </RowHelp>
                </th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  {e.malformed ? (
                    <td colSpan={4}>
                      <Badge bg="warning" text="dark" className="me-2">
                        non-standard entry
                      </Badge>
                      <code className="small">{e.rawLine.trim()}</code>
                      <RowHelp title="Non-standard entry">
                        <MalformedEntryHelp />
                      </RowHelp>
                    </td>
                  ) : (
                    <>
                      <td>
                        <code className="small">{e.selectorDomain}</code>
                      </td>
                      <td>
                        <strong>{e.domain}</strong>
                      </td>
                      <td>
                        <Badge bg="secondary">{e.selector}</Badge>
                      </td>
                      <td>
                        <code className="small">{e.keyPath}</code>
                      </td>
                    </>
                  )}
                  <td className="text-end">
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="me-1"
                      title="View details"
                      onClick={() => router.push(`/rules/keys/${encodeURIComponent(e.id)}`)}
                    >
                      <i className="bi bi-eye"></i>
                    </Button>
                    {!e.malformed && (
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={() => {
                          setShowConfirm(e);
                          setRegenResult(null);
                        }}
                        disabled={regenerating === e.id}
                      >
                        {regenerating === e.id ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <i className="bi bi-arrow-clockwise me-1"></i>Regenerate
                          </>
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No key entries found. Add a domain via the Domains page to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={!!showConfirm} onHide={() => setShowConfirm(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {regenResult ? (
              <>
                <i className="bi bi-check-circle text-success me-2"></i>Key regenerated
              </>
            ) : (
              <>
                <i className="bi bi-exclamation-triangle text-warning me-2"></i>Regenerate key
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {regenResult ? (
            <>
              <Alert variant="success">
                New key generated for <strong>{showConfirm?.domain}</strong>. Update the DNS TXT
                record:
              </Alert>
              <p className="mb-2">
                <strong>Record name:</strong>{' '}
                <code>
                  {showConfirm?.selector}._domainkey.{showConfirm?.domain}
                </code>
              </p>
              <div className="dns-record mb-3">{regenResult.bindRecord}</div>
              <Alert variant="warning" className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Mail signed with the old key will fail DKIM verification until DNS propagates
                with the new public key. Reload OpenDKIM after updating DNS.
              </Alert>
            </>
          ) : (
            <>
              <p>
                Regenerate the DKIM key for <strong>{showConfirm?.domain}</strong>?
              </p>
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                This will overwrite the existing private key. You will need to update the DNS TXT
                record with the new public key. Mail signed with the old key will fail
                verification.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(null)}>
            {regenResult ? 'Close' : 'Cancel'}
          </Button>
          {!regenResult && (
            <Button variant="warning" onClick={handleRegenerate} disabled={!!regenerating}>
              {regenerating ? (
                <>
                  <Spinner size="sm" className="me-1" />
                  Generating…
                </>
              ) : (
                'Regenerate key'
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
