'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Container, Card, Table, Button, Modal, Form, Alert, Spinner, Badge, Row, Col,
} from 'react-bootstrap';

interface DnsExpected {
  recordName: string;
  recordType: string;
  expectedValue: string;
}

interface DnsVerification {
  domain: string;
  selector: string;
  recordName: string;
  expected: DnsExpected | null;
  liveValue: string | null;
  status: 'valid' | 'mismatch' | 'missing' | 'no_key';
  detail: string;
}

interface DomainInfo {
  pattern: string;
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
  expected: DnsExpected | null;
  verification: DnsVerification;
}

const statusBadge = (status: DnsVerification['status']) => {
  switch (status) {
    case 'valid':
      return <Badge bg="success"><i className="bi bi-check-circle me-1"></i>Verified</Badge>;
    case 'mismatch':
      return <Badge bg="danger"><i className="bi bi-x-circle me-1"></i>Mismatch</Badge>;
    case 'missing':
      return <Badge bg="warning" text="dark"><i className="bi bi-exclamation-triangle me-1"></i>Not in DNS</Badge>;
    case 'no_key':
      return <Badge bg="secondary"><i className="bi bi-question-circle me-1"></i>No Key</Badge>;
  }
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDelete, setShowDelete] = useState<DomainInfo | null>(null);
  const [showDns, setShowDns] = useState<DomainInfo | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [addResult, setAddResult] = useState<{ dnsRecord: string; bindRecord: string } | null>(null);

  const [newDomain, setNewDomain] = useState('');
  const [newSelector, setNewSelector] = useState('mail');
  const [newFromPattern, setNewFromPattern] = useState('');

  const fetchDomains = useCallback(() => {
    setLoading(true);
    fetch('/api/dns')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setDomains(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  useEffect(() => {
    if (newDomain) setNewFromPattern(`*@${newDomain}`);
  }, [newDomain]);

  const handleVerifySingle = async (d: DomainInfo) => {
    setVerifying(d.domain);
    try {
      const res = await fetch(`/api/dns?domain=${encodeURIComponent(d.domain)}&selector=${encodeURIComponent(d.selector)}`);
      const result: DnsVerification = await res.json();
      setDomains(prev => prev.map(dom =>
        dom.domain === d.domain ? { ...dom, verification: result } : dom
      ));
    } catch (err) {
      setError(String(err));
    } finally {
      setVerifying(null);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, selector: newSelector, fromPattern: newFromPattern }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAddResult(data);
      fetchDomains();
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!showDelete) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/domains', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: showDelete.domain, selector: showDelete.selector }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setShowDelete(null);
      fetchDomains();
    } catch (err) {
      setError(String(err));
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
        <h2><i className="bi bi-globe me-2"></i>Domains</h2>
        <div>
          <Button variant="outline-secondary" className="me-2" onClick={fetchDomains}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh All
          </Button>
          <Button variant="primary" onClick={() => { setShowAdd(true); setAddResult(null); setNewDomain(''); setNewSelector('mail'); }}>
            <i className="bi bi-plus-circle me-1"></i>Add Domain
          </Button>
        </div>
      </div>

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
                <th>From Pattern</th>
                <th>Selector</th>
                <th>DNS Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={i}>
                  <td><strong>{d.domain}</strong></td>
                  <td><code>{d.pattern}</code></td>
                  <td><Badge bg="secondary">{d.selector}</Badge></td>
                  <td>
                    {verifying === d.domain ? (
                      <Spinner size="sm" variant="primary" />
                    ) : (
                      statusBadge(d.verification.status)
                    )}
                  </td>
                  <td className="text-end">
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="me-1"
                      title="View DNS record"
                      onClick={() => setShowDns(d)}
                    >
                      <i className="bi bi-card-text"></i>
                    </Button>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-1"
                      title="Verify DNS"
                      onClick={() => handleVerifySingle(d)}
                      disabled={verifying === d.domain}
                    >
                      <i className="bi bi-search"></i>
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      title="Remove domain"
                      onClick={() => setShowDelete(d)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
              {domains.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No domains configured. Click &quot;Add Domain&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Add Domain Modal */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title><i className="bi bi-plus-circle me-2"></i>Add Domain</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addResult ? (
            <>
              <Alert variant="success">
                <i className="bi bi-check-circle me-2"></i>Domain added successfully! Add this DNS TXT record:
              </Alert>
              <div className="dns-record mb-3">{addResult.bindRecord}</div>
              <Alert variant="info" className="mb-0">
                <i className="bi bi-info-circle me-2"></i>
                After adding the DNS record, reload OpenDKIM for changes to take effect.
              </Alert>
            </>
          ) : (
            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Domain</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="example.com"
                      value={newDomain}
                      onChange={e => setNewDomain(e.target.value)}
                    />
                    <Form.Text className="text-muted">The domain to sign mail for</Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Selector</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="mail"
                      value={newSelector}
                      onChange={e => setNewSelector(e.target.value)}
                    />
                    <Form.Text className="text-muted">DKIM selector (typically &quot;mail&quot;)</Form.Text>
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label>From Pattern</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="*@example.com"
                  value={newFromPattern}
                  onChange={e => setNewFromPattern(e.target.value)}
                />
                <Form.Text className="text-muted">
                  Pattern to match in the From header (e.g. *@example.com or *@id.example.com)
                </Form.Text>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAdd(false)}>
            {addResult ? 'Close' : 'Cancel'}
          </Button>
          {!addResult && (
            <Button variant="primary" onClick={handleAdd} disabled={adding || !newDomain || !newSelector}>
              {adding ? <><Spinner size="sm" className="me-1" />Generating...</> : 'Add Domain & Generate Key'}
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={!!showDelete} onHide={() => setShowDelete(null)}>
        <Modal.Header closeButton>
          <Modal.Title><i className="bi bi-exclamation-triangle text-danger me-2"></i>Remove Domain</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to remove <strong>{showDelete?.domain}</strong>?</p>
          <p className="text-muted mb-0">
            This will remove the domain from SigningTable and KeyTable. Key files on disk will not be deleted.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? <><Spinner size="sm" className="me-1" />Removing...</> : 'Remove Domain'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* DNS Record Detail Modal */}
      <Modal show={!!showDns} onHide={() => setShowDns(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title><i className="bi bi-card-text me-2"></i>DNS Record &mdash; {showDns?.domain}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {showDns && (
            <>
              <h6>Record Details</h6>
              <Table bordered size="sm" className="mb-4">
                <tbody>
                  <tr>
                    <td className="fw-bold" style={{ width: '30%' }}>Record Name</td>
                    <td><code>{showDns.verification.recordName}</code></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Record Type</td>
                    <td><code>TXT</code></td>
                  </tr>
                  <tr>
                    <td className="fw-bold">Status</td>
                    <td>{statusBadge(showDns.verification.status)} <span className="text-muted ms-2">{showDns.verification.detail}</span></td>
                  </tr>
                </tbody>
              </Table>

              <h6>Expected TXT Value</h6>
              <p className="text-muted small mb-1">This is what the DNS record should contain, derived from the private key on disk:</p>
              {showDns.expected ? (
                <div className="dns-record mb-4">{showDns.expected.expectedValue}</div>
              ) : (
                <Alert variant="secondary" className="mb-4">No private key found &mdash; cannot derive expected value.</Alert>
              )}

              {showDns.verification.liveValue && (
                <>
                  <h6>Live DNS Value</h6>
                  <p className="text-muted small mb-1">This is what was returned by querying DNS right now:</p>
                  <div className="dns-record mb-3">{showDns.verification.liveValue}</div>
                </>
              )}

              {showDns.verification.status === 'missing' && showDns.expected && (
                <Alert variant="info" className="mb-0">
                  <i className="bi bi-info-circle me-2"></i>
                  Create a TXT record for <code>{showDns.expected.recordName}</code> with the expected value above.
                </Alert>
              )}
              {showDns.verification.status === 'mismatch' && (
                <Alert variant="danger" className="mb-0">
                  <i className="bi bi-exclamation-octagon me-2"></i>
                  The DNS record does not match the key on disk. Update the DNS TXT record with the expected value, or regenerate the key to match what is in DNS.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-primary"
            onClick={() => showDns && handleVerifySingle(showDns)}
            disabled={!!(showDns && verifying === showDns.domain)}
          >
            {showDns && verifying === showDns.domain ? (
              <><Spinner size="sm" className="me-1" />Checking...</>
            ) : (
              <><i className="bi bi-arrow-clockwise me-1"></i>Re-check DNS</>
            )}
          </Button>
          <Button variant="secondary" onClick={() => setShowDns(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
