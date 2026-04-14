'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Container, Nav, Navbar as BSNavbar } from 'react-bootstrap';

export default function AppNavbar() {
  const pathname = usePathname();

  return (
    <BSNavbar bg="dark" variant="dark" expand="lg" className="mb-4">
      <Container>
        <BSNavbar.Brand as={Link} href="/">
          <i className="bi bi-shield-lock me-2"></i>
          DKIM Dashboard
        </BSNavbar.Brand>
        <BSNavbar.Toggle aria-controls="main-nav" />
        <BSNavbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} href="/" active={pathname === '/'}>
              <i className="bi bi-speedometer2 me-1"></i>Overview
            </Nav.Link>
            <Nav.Link as={Link} href="/domains" active={pathname === '/domains'}>
              <i className="bi bi-globe me-1"></i>Domains
            </Nav.Link>
            <Nav.Link
              as={Link}
              href="/rules/signing"
              active={pathname === '/rules/signing' || pathname.startsWith('/rules/signing/')}
            >
              <i className="bi bi-list-ul me-1"></i>Signing Rules
            </Nav.Link>
            <Nav.Link
              as={Link}
              href="/keys"
              active={pathname === '/keys' || pathname.startsWith('/rules/keys/')}
            >
              <i className="bi bi-key me-1"></i>Keys
            </Nav.Link>
            <Nav.Link as={Link} href="/trusted-hosts" active={pathname === '/trusted-hosts'}>
              <i className="bi bi-people me-1"></i>Trusted Hosts
            </Nav.Link>
            <Nav.Link as={Link} href="/config" active={pathname === '/config'}>
              <i className="bi bi-gear me-1"></i>Config
            </Nav.Link>
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
}
