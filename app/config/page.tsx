'use client';

import { useEffect, useState } from 'react';
import {
  Container, Card, Alert, Spinner, Tabs, Tab, Button,
} from 'react-bootstrap';

interface ConfigData {
  config: string;
  signingTable: string;
  keyTable: string;
}

export default function ConfigPage() {
  const [data, setData] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloadResult, setReloadResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleReload = async () => {
    setReloading(true);
    setReloadResult(null);
    try {
      const res = await fetch('/api/service', { method: 'POST' });
      const result = await res.json();
      setReloadResult(result);
    } catch (err) {
      setReloadResult({ success: false, message: String(err) });
    } finally {
      setReloading(false);
    }
  };

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
          <i className="bi bi-exclamation-triangle me-2"></i>{error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2><i className="bi bi-gear me-2"></i>Configuration</h2>
        <Button variant="warning" onClick={handleReload} disabled={reloading}>
          {reloading ? (
            <><Spinner size="sm" className="me-1" />Reloading...</>
          ) : (
            <><i className="bi bi-arrow-clockwise me-1"></i>Reload OpenDKIM</>
          )}
        </Button>
      </div>

      {reloadResult && (
        <Alert variant={reloadResult.success ? 'success' : 'danger'} dismissible onClose={() => setReloadResult(null)}>
          <i className={`bi ${reloadResult.success ? 'bi-check-circle' : 'bi-exclamation-triangle'} me-2`}></i>
          {reloadResult.message}
        </Alert>
      )}

      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="main" className="mb-3">
            <Tab eventKey="main" title={<><i className="bi bi-file-earmark-text me-1"></i>opendkim.conf</>}>
              <pre className="config-view">{data?.config}</pre>
            </Tab>
            <Tab eventKey="signing" title={<><i className="bi bi-pencil-square me-1"></i>SigningTable</>}>
              <pre className="config-view">{data?.signingTable}</pre>
            </Tab>
            <Tab eventKey="key" title={<><i className="bi bi-key me-1"></i>KeyTable</>}>
              <pre className="config-view">{data?.keyTable}</pre>
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </Container>
  );
}
