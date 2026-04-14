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

export default function TrustedHostsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<TrustedHostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState<TrustedHostEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEntries = useCallback(() => {
    setLoading(true);
    fetch('/api/trusted-hosts')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TrustedHostEntry[];
      })
      .then(setEntries)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleDelete = async () => {
    if (!showDelete) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trusted-hosts/${encodeURIComponent(showDelete.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setShowDelete(null);
      fetchEntries();
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
        <h2 className="mb-0">
          <i className="bi bi-people me-2"></i>Trusted Hosts
        </h2>
        <div className="d-flex gap-2 align-items-center">
          <AboutThisPage title="About the Trusted Hosts page">
            <TrustedHostsPageHelp />
          </AboutThisPage>
          <Button variant="outline-secondary" onClick={fetchEntries}>
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </Button>
          <Button variant="primary" onClick={() => router.push('/trusted-hosts/new')}>
            <i className="bi bi-plus-circle me-1"></i>Add Trusted Host
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
                </th>
                <th>
                  Inline comment
                  <RowHelp title="Inline comments">
                    <InlineCommentHelp />
                  </RowHelp>
                </th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    <code>{e.value}</code>
                    {e.isRefile && (
                      <Badge bg="info" className="ms-2">
                        refile
                      </Badge>
                    )}
                  </td>
                  <td>
                    {e.inlineComment ? (
                      <span className="text-muted small font-monospace">{e.inlineComment}</span>
                    ) : (
                      <span className="text-muted small fst-italic">—</span>
                    )}
                  </td>
                  <td className="text-end">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-1"
                      title="Edit trusted host"
                      onClick={() => router.push(`/trusted-hosts/${encodeURIComponent(e.id)}`)}
                    >
                      <i className="bi bi-pencil"></i>
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      title="Delete trusted host"
                      onClick={() => setShowDelete(e)}
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    No trusted hosts configured. Click &quot;Add Trusted Host&quot; to add one.
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
            Delete trusted host
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Delete this trusted host entry?</p>
          <pre className="p-2 bg-light rounded border mb-0">
            {showDelete?.value}
            {showDelete?.inlineComment ? ` ${showDelete.inlineComment}` : ''}
          </pre>
          <p className="text-muted small mt-2 mb-0">
            Comments and blank lines attached to this entry will be removed with it. Other
            entries are unaffected.
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
