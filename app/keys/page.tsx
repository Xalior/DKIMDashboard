'use client';

import { useEffect, useState } from 'react';
import {
  Container, Card, Table, Button, Modal, Alert, Spinner, Badge,
} from 'react-bootstrap';

interface KeyInfo {
  domain: string;
  selector: string;
  keyPath: string;
  files: string[];
}

export default function KeysPage() {
  const [keys, setKeys] = useState<KeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<KeyInfo | null>(null);
  const [regenResult, setRegenResult] = useState<{ dnsRecord: string; bindRecord: string } | null>(null);

  const fetchKeys = () => {
    setLoading(true);
    fetch('/api/keys')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setKeys(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleRegenerate = async () => {
    if (!showConfirm) return;
    setRegenerating(showConfirm.domain);
    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: showConfirm.domain, selector: showConfirm.selector }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRegenResult(data);
      fetchKeys();
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
      <h2 className="mb-4"><i className="bi bi-key me-2"></i>Keys</h2>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>{error}
        </Alert>
      )}

      <Card>
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Domain</th>
                <th>Selector</th>
                <th>Key Path</th>
                <th>Key Files</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k, i) => (
                <tr key={i}>
                  <td><strong>{k.domain}</strong></td>
                  <td><Badge bg="secondary">{k.selector}</Badge></td>
                  <td><code className="small">{k.keyPath}</code></td>
                  <td>
                    {k.files.map((f, j) => (
                      <Badge key={j} bg="light" text="dark" className="me-1">{f}</Badge>
                    ))}
                  </td>
                  <td className="text-end">
                    <Button
                      variant="outline-warning"
                      size="sm"
                      onClick={() => { setShowConfirm(k); setRegenResult(null); }}
                      disabled={regenerating === k.domain}
                    >
                      {regenerating === k.domain ? (
                        <Spinner size="sm" />
                      ) : (
                        <><i className="bi bi-arrow-clockwise me-1"></i>Regenerate</>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No keys found
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Regenerate Confirmation Modal */}
      <Modal show={!!showConfirm} onHide={() => setShowConfirm(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {regenResult ? (
              <><i className="bi bi-check-circle text-success me-2"></i>Key Regenerated</>
            ) : (
              <><i className="bi bi-exclamation-triangle text-warning me-2"></i>Regenerate Key</>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {regenResult ? (
            <>
              <Alert variant="success">
                New key generated for <strong>{showConfirm?.domain}</strong>. Update the DNS TXT record:
              </Alert>
              <p className="mb-2"><strong>Record name:</strong> <code>{showConfirm?.selector}._domainkey.{showConfirm?.domain}</code></p>
              <div className="dns-record mb-3">{regenResult.bindRecord}</div>
              <Alert variant="warning" className="mb-0">
                <i className="bi bi-exclamation-triangle me-2"></i>
                Mail signed with the old key will fail DKIM verification until DNS propagates with the new public key. Reload OpenDKIM after updating DNS.
              </Alert>
            </>
          ) : (
            <>
              <p>Regenerate the DKIM key for <strong>{showConfirm?.domain}</strong>?</p>
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                This will overwrite the existing private key. You will need to update the DNS TXT record with the new public key. Mail signed with the old key will fail verification.
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
              {regenerating ? <><Spinner size="sm" className="me-1" />Generating...</> : 'Regenerate Key'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
