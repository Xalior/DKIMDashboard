'use client';

import { ReactNode, useState } from 'react';
import { Button } from 'react-bootstrap';

import HelpModal from './HelpModal';

interface Props {
  title: string;
  children: ReactNode;
}

export default function AboutThisPage({ title, children }: Props) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button
        variant="outline-info"
        size="sm"
        onClick={() => setShow(true)}
        aria-label="About this page"
      >
        <i className="bi bi-info-circle me-1"></i>About this page
      </Button>
      <HelpModal show={show} onClose={() => setShow(false)} title={title}>
        {children}
      </HelpModal>
    </>
  );
}
