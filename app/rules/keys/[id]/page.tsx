'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Card, Container, Spinner, Table } from 'react-bootstrap';

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

interface KeyEntryDetail {
  entry: KeyEntry;
  diskFiles: string[] | null;
  dnsExpected: DnsExpected | null;
  dnsVerification: DnsVerification | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function statusBadge(status: DnsVerification['status']): React.ReactElement {
  switch (status) {
    case 'valid':
      return <Badge bg="success"><i className="bi bi-check-circle me-1"></i>Verified</Badge>;
    case 'mismatch':
      return <Badge bg="danger"><i className="bi bi-x-circle me-1"></i>Mismatch</Badge>;
    case 'missing':
      return <Badge bg="warning" text="dark"><i className="bi bi-exclamation-triangle me-1"></i>Not in DNS</Badge>;
    case 'no_key':
      return <Badge bg="secondary"><i className="bi bi-question-circle me-1"></i>No key on disk</Badge>;
  }
}

export default function KeyDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<KeyEntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/rules/keys/${encodeURIComponent(id)}`)
      .then(async (r) => {
        if (r.status === 404) {
          if (alive) setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as KeyEntryDetail;
      })
      .then((body) => {
        if (!alive || !body) return;
        setDetail(body);
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

  if (loading) {
    return (
      <Container className="text-center py-5">
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }

  if (notFound || !detail) {
    return (
      <Container className="py-4" style={{ maxWidth: '42rem' }}>
        <h2 className="mb-3">
          <i className="bi bi-exclamation-triangle me-2"></i>Key entry not found
        </h2>
        <Alert variant="warning">
          No key entry with id <code>{id}</code>. It may have been removed or the file may have
          been edited outside the dashboard.
        </Alert>
        <Button variant="primary" onClick={() => router.push('/keys')}>
          Back to Keys
        </Button>
      </Container>
    );
  }

  const { entry, diskFiles, dnsExpected, dnsVerification } = detail;

  return (
    <Container className="py-4" style={{ maxWidth: '56rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <i className="bi bi-key me-2"></i>Key entry detail
          </h2>
          <Link href="/keys" className="text-muted small">
            <i className="bi bi-arrow-left me-1"></i>Back to Keys
          </Link>
        </div>
        <AboutThisPage title="About this key entry">
          <KeyEntriesPageHelp />
        </AboutThisPage>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {entry.malformed ? (
        <Card>
          <Card.Header>
            <Badge bg="warning" text="dark" className="me-2">
              non-standard entry
            </Badge>
            This line isn&apos;t in the canonical shape
            <RowHelp title="Non-standard entry">
              <MalformedEntryHelp />
            </RowHelp>
          </Card.Header>
          <Card.Body>
            <p className="text-muted small mb-2">Raw line (preserved byte-for-byte):</p>
            <pre className="p-3 bg-light rounded border mb-3">{entry.rawLine}</pre>
            <p className="mb-0">
              The dashboard can&apos;t parse this as <code>selectorDomain domain:selector:keyPath</code>,
              so detail fields and DNS verification aren&apos;t available. Edit{' '}
              <code>/etc/opendkim/KeyTable</code> directly if this needs correcting — the
              dashboard will round-trip your fix on the next write.
            </p>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <Card.Header>Entry</Card.Header>
            <Card.Body>
              <Table bordered size="sm" className="mb-0">
                <tbody>
                  <tr>
                    <td className="fw-bold" style={{ width: '30%' }}>
                      selectorDomain
                      <RowHelp title="selectorDomain">
                        <SelectorDomainHelp />
                      </RowHelp>
                    </td>
                    <td>
                      <code>{entry.selectorDomain}</code>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-bold">
                      Domain
                      <RowHelp title="Domain">
                        <DomainHelp />
                      </RowHelp>
                    </td>
                    <td>
                      <strong>{entry.domain}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-bold">
                      Selector
                      <RowHelp title="Selector">
                        <SelectorHelp />
                      </RowHelp>
                    </td>
                    <td>
                      <Badge bg="secondary">{entry.selector}</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="fw-bold">
                      Key path
                      <RowHelp title="Key path">
                        <KeyPathHelp />
                      </RowHelp>
                    </td>
                    <td>
                      <code className="small">{entry.keyPath}</code>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>Key files on disk</Card.Header>
            <Card.Body>
              {diskFiles && diskFiles.length > 0 ? (
                <div className="d-flex flex-wrap gap-1">
                  {diskFiles.map((f) => (
                    <Badge key={f} bg="light" text="dark" className="border">
                      {f}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted">
                  No files found under <code>{entry.keyPath.replace(/\/[^/]+$/, '')}</code>.
                </span>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-4">
            <Card.Header>DNS</Card.Header>
            <Card.Body>
              {dnsVerification && (
                <>
                  <div className="mb-3">
                    {statusBadge(dnsVerification.status)}
                    <span className="text-muted ms-2">{dnsVerification.detail}</span>
                  </div>
                  {dnsExpected && (
                    <>
                      <p className="mb-1 small text-muted">Expected TXT value:</p>
                      <div className="dns-record mb-3">{dnsExpected.expectedValue}</div>
                    </>
                  )}
                  {dnsVerification.liveValue && (
                    <>
                      <p className="mb-1 small text-muted">Live TXT value:</p>
                      <div className="dns-record mb-0">{dnsVerification.liveValue}</div>
                    </>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        </>
      )}
    </Container>
  );
}
