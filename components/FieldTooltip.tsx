'use client';

import { ReactElement } from 'react';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';
import type { Placement } from 'react-bootstrap/esm/types';

interface Props {
  content: string;
  placement?: Placement;
  id: string;
  children: ReactElement;
}

/**
 * Inline field tooltip. OverlayTrigger handles aria-describedby on the
 * trigger while the tooltip is visible, so screen-reader announcement of
 * the child element includes the tooltip content.
 */
export default function FieldTooltip({ content, placement = 'top', id, children }: Props) {
  return (
    <OverlayTrigger placement={placement} overlay={<Tooltip id={id}>{content}</Tooltip>}>
      {children}
    </OverlayTrigger>
  );
}
