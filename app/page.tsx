'use client';

import { useEffect, useState } from 'react';
import { Container, Row, Col, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import Link from 'next/link';

interface DnsVerification {
  status: 'valid' | 'mismatch' | 'missing' | 'no_key';
  detail: string;
}

interface DomainInfo {
  pattern: string;
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
  verification: DnsVerification;
}

interface TrustedHost {
  value: string;
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

export default function Dashboard() {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [hosts, setHosts] = useState<TrustedHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/dns').then(r => r.json()),
      fetch('/api/trusted-hosts').then(r => r.json()),
    ])
      .then(([d, h]) => {
        if (d.error) throw new Error(d.error);
        if (h.error) throw new Error(h.error);
        setDomains(d);
        setHosts(h);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const validCount = domains.filter(d => d.verification.status === 'valid').length;
  const issueCount = domains.filter(d => d.verification.status !== 'valid').length;

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">
        <i className="bi bi-speedometer2 me-2"></i>Overview
      </h2>

      <Row className="mb-4">
        <Col md={3}>
          <Card className="stat-card h-100">
            <Card.Body className="text-center">
              <div className="display-4 text-primary mb-2">
                <i className="bi bi-globe"></i>
              </div>
              <h1 className="display-5 fw-bold">{domains.length}</h1>
              <p className="text-muted mb-0">Signing Domains</p>
            </Card.Body>
            <Card.Footer className="text-center bg-transparent border-0 pb-3">
              <Link href="/domains" className="btn btn-outline-primary btn-sm">
                Manage Domains
              </Link>
            </Card.Footer>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stat-card h-100">
            <Card.Body className="text-center">
              <div className="display-4 text-success mb-2">
                <i className="bi bi-check-circle"></i>
              </div>
              <h1 className="display-5 fw-bold">{validCount}</h1>
              <p className="text-muted mb-0">DNS Verified</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className={`stat-card h-100 ${issueCount > 0 ? 'border-warning' : ''}`}>
            <Card.Body className="text-center">
              <div className={`display-4 ${issueCount > 0 ? 'text-warning' : 'text-muted'} mb-2`}>
                <i className="bi bi-exclamation-triangle"></i>
              </div>
              <h1 className="display-5 fw-bold">{issueCount}</h1>
              <p className="text-muted mb-0">DNS Issues</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="stat-card h-100">
            <Card.Body className="text-center">
              <div className="display-4 text-info mb-2">
                <i className="bi bi-people"></i>
              </div>
              <h1 className="display-5 fw-bold">{hosts.length}</h1>
              <p className="text-muted mb-0">Trusted Hosts</p>
            </Card.Body>
            <Card.Footer className="text-center bg-transparent border-0 pb-3">
              <Link href="/trusted-hosts" className="btn btn-outline-info btn-sm">
                Manage Hosts
              </Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header>
          <i className="bi bi-list-check me-2"></i>Domain Summary
        </Card.Header>
        <Card.Body className="p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  <th>Domain</th>
                  <th>From Pattern</th>
                  <th>Selector</th>
                  <th>DNS Status</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((d, i) => (
                  <tr key={i}>
                    <td><strong>{d.domain}</strong></td>
                    <td><code>{d.pattern}</code></td>
                    <td><Badge bg="secondary">{d.selector}</Badge></td>
                    <td>{statusBadge(d.verification.status)}</td>
                  </tr>
                ))}
                {domains.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-4">
                      No domains configured
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
