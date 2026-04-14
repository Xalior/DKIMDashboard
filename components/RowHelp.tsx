'use client';

import { ReactNode, useState } from 'react';
import { Button } from 'react-bootstrap';

import HelpModal from './HelpModal';

interface Props {
  title: string;
  children: ReactNode;
  label?: string;
}

export default function RowHelp({ title, children, label }: Props) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button
        variant="link"
        size="sm"
        className="p-0 ms-1"
        onClick={() => setShow(true)}
        aria-label={label ?? `Help: ${title}`}
        title="More info"
      >
        <i className="bi bi-question-circle"></i>
      </Button>
      <HelpModal show={show} onClose={() => setShow(false)} title={title}>
        {children}
      </HelpModal>
    </>
  );
}
