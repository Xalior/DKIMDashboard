'use client';

import { ReactNode } from 'react';
import { Button, Modal } from 'react-bootstrap';

interface Props {
  show: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function HelpModal({ show, onClose, title, children }: Props) {
  return (
    <Modal show={show} onHide={onClose} size="lg" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-question-circle me-2"></i>
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
