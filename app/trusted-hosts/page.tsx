'use client';

import { useEffect, useState } from 'react';
import {
  Container, Card, ListGroup, Button, Form, InputGroup, Alert, Spinner,
} from 'react-bootstrap';

interface TrustedHost {
  value: string;
}

export default function TrustedHostsPage() {
  const [hosts, setHosts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newHost, setNewHost] = useState('');
  const [dirty, setDirty] = useState(false);

  const fetchHosts = () => {
    setLoading(true);
    fetch('/api/trusted-hosts')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setHosts(data.map((h: TrustedHost) => h.value));
        setDirty(false);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchHosts(); }, []);

  const addHost = () => {
    const trimmed = newHost.trim();
    if (!trimmed || hosts.includes(trimmed)) return;
    setHosts([...hosts, trimmed]);
    setNewHost('');
    setDirty(true);
  };

  const removeHost = (index: number) => {
    setHosts(hosts.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/trusted-hosts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuccess('Trusted hosts saved. Reload OpenDKIM for changes to take effect.');
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
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
        <h2><i className="bi bi-people me-2"></i>Trusted Hosts</h2>
        {dirty && (
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size="sm" className="me-1" />Saving...</> : <><i className="bi bi-save me-1"></i>Save Changes</>}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          <i className="bi bi-exclamation-triangle me-2"></i>{error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          <i className="bi bi-check-circle me-2"></i>{success}
        </Alert>
      )}

      <Card>
        <Card.Header>
          <i className="bi bi-info-circle me-2"></i>
          Hosts and networks listed here are trusted to send mail to be signed. Use IP addresses, CIDR ranges, or hostnames.
        </Card.Header>
        <Card.Body>
          <InputGroup className="mb-3">
            <Form.Control
              type="text"
              placeholder="e.g. 127.0.0.1, 10.0.0.0/8, or mail.example.com"
              value={newHost}
              onChange={e => setNewHost(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHost())}
            />
            <Button variant="outline-primary" onClick={addHost} disabled={!newHost.trim()}>
              <i className="bi bi-plus-circle me-1"></i>Add
            </Button>
          </InputGroup>

          <ListGroup>
            {hosts.map((host, i) => (
              <ListGroup.Item key={i} className="d-flex justify-content-between align-items-center">
                <code>{host}</code>
                <Button variant="outline-danger" size="sm" onClick={() => removeHost(i)}>
                  <i className="bi bi-trash"></i>
                </Button>
              </ListGroup.Item>
            ))}
            {hosts.length === 0 && (
              <ListGroup.Item className="text-center text-muted">
                No trusted hosts configured
              </ListGroup.Item>
            )}
          </ListGroup>
        </Card.Body>
      </Card>
    </Container>
  );
}
