import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { generateKeyPairSync, createPublicKey } from 'crypto';
import { resolveTxt } from 'dns/promises';

import {
  parseSigningTable as parseSigningTableV2,
  listRules,
  addRule,
  removeRule,
  mutateSigningTable,
} from './signing-table';
import { DuplicateEntryError } from './errors';

const CANONICAL_CONFIG_DIR = '/etc/opendkim';

function configDir(): string {
  return process.env.OPENDKIM_CONFIG_DIR || CANONICAL_CONFIG_DIR;
}

function confFile(): string {
  return process.env.OPENDKIM_CONF || '/etc/opendkim.conf';
}

function pidFile(): string {
  return process.env.OPENDKIM_PID_FILE || '/run/opendkim/opendkim.pid';
}

// --- Data types ---

export interface DomainEntry {
  pattern: string;       // e.g. *@id.nextbestnetwork.com
  selectorDomain: string; // e.g. mail._domainkey.nextbestnetwork.com
  domain: string;        // e.g. nextbestnetwork.com
  selector: string;      // e.g. mail
  keyPath: string;       // e.g. /etc/opendkim/keys/nextbestnetwork.com/mail.private
}

export interface TrustedHost {
  value: string;
}

// --- Parsing ---

/**
 * Legacy projection of SigningTable content to the pre-Phase-1 shape.
 * New code should prefer `listRules(parseSigningTableV2(raw).lines)` from
 * `./signing-table`, which preserves ids and the full round-trip model.
 * Retained for any remaining callers that expect the old shape.
 */
export function parseSigningTable(content: string): { pattern: string; selectorDomain: string }[] {
  return listRules(parseSigningTableV2(content).lines).map((r) => ({
    pattern: r.pattern,
    selectorDomain: r.keyRef,
  }));
}

export function parseKeyTable(content: string): { selectorDomain: string; domain: string; selector: string; keyPath: string }[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const parts = line.split(/\s+/);
      const selectorDomain = parts[0];
      const valueParts = parts[1].split(':');
      return {
        selectorDomain,
        domain: valueParts[0],
        selector: valueParts[1],
        keyPath: valueParts[2],
      };
    });
}

export function parseTrustedHosts(content: string): TrustedHost[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(value => ({ value }));
}

// --- Reading ---

export async function readSigningTable(): Promise<string> {
  return readFile(join(configDir(), 'SigningTable'), 'utf-8');
}

export async function readKeyTable(): Promise<string> {
  return readFile(join(configDir(), 'KeyTable'), 'utf-8');
}

export async function readTrustedHosts(): Promise<string> {
  return readFile(join(configDir(), 'TrustedHosts'), 'utf-8');
}

export async function readConfig(): Promise<string> {
  return readFile(confFile(), 'utf-8');
}

export async function getDomains(): Promise<DomainEntry[]> {
  const [signingRaw, keyRaw] = await Promise.all([readSigningTable(), readKeyTable()]);
  const rules = listRules(parseSigningTableV2(signingRaw).lines);
  const keys = parseKeyTable(keyRaw);

  return rules.map((r) => {
    const k = keys.find((k) => k.selectorDomain === r.keyRef);
    return {
      pattern: r.pattern,
      selectorDomain: r.keyRef,
      domain: k?.domain || '',
      selector: k?.selector || '',
      keyPath: k?.keyPath || '',
    };
  });
}

export async function getDnsRecord(domain: string, selector: string): Promise<string | null> {
  const txtPath = join(configDir(), 'keys', domain, `${selector}.txt`);
  try {
    return await readFile(txtPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function listKeyFiles(domain: string): Promise<string[]> {
  const keyDir = join(configDir(), 'keys', domain);
  try {
    const files = await readdir(keyDir);
    return files;
  } catch {
    return [];
  }
}

// --- Helpers ---

function pubPemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
}

function formatDkimDnsValue(pubBase64: string): string {
  return `v=DKIM1; h=sha256; k=rsa; p=${pubBase64}`;
}

function formatDkimBindRecord(domain: string, selector: string, pubBase64: string): string {
  return `${selector}._domainkey.${domain}. IN TXT ( "${formatDkimDnsValue(pubBase64)}" )`;
}

// --- Writing ---

export async function generateDkimKey(domain: string, selector: string): Promise<{ privateKeyPem: string; dnsRecord: string; bindRecord: string }> {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const pubBase64 = pubPemToBase64(publicKey);

  return {
    privateKeyPem: privateKey,
    dnsRecord: formatDkimDnsValue(pubBase64),
    bindRecord: formatDkimBindRecord(domain, selector, pubBase64),
  };
}

export async function addDomain(domain: string, selector: string, fromPattern: string): Promise<{ dnsRecord: string; bindRecord: string }> {
  const keyDir = join(configDir(), 'keys', domain);
  if (!existsSync(keyDir)) {
    await mkdir(keyDir, { recursive: true });
  }

  const { privateKeyPem, dnsRecord, bindRecord } = await generateDkimKey(domain, selector);

  // Write private key
  const keyPath = join(keyDir, `${selector}.private`);
  await writeFile(keyPath, privateKeyPem, { mode: 0o600 });

  // Write DNS record template
  const txtPath = join(keyDir, `${selector}.txt`);
  await writeFile(txtPath, bindRecord + '\n', { mode: 0o644 });

  // Append to SigningTable via the round-trip-safe writer. The whole
  // read-modify-write runs under a per-path mutex. Idempotent: if a rule
  // with the same (pattern, keyRef) already exists, skip (matches the
  // pre-refactor .includes() check).
  const selectorDomain = `${selector}._domainkey.${domain}`;
  try {
    await mutateSigningTable((parsed) => ({
      ...parsed,
      lines: addRule(parsed.lines, { pattern: fromPattern, keyRef: selectorDomain }),
    }));
  } catch (err) {
    if (!(err instanceof DuplicateEntryError)) throw err;
    // Identical rule already present — no-op, matches legacy behaviour.
  }

  // Append to KeyTable (always use canonical production path)
  const canonicalKeyPath = join(CANONICAL_CONFIG_DIR, 'keys', domain, `${selector}.private`);
  const keyTablePath = join(configDir(), 'KeyTable');
  const keyTableContent = await readFile(keyTablePath, 'utf-8');
  const keyLine = `${selector}._domainkey.${domain} ${domain}:${selector}:${canonicalKeyPath}`;
  if (!keyTableContent.includes(keyLine)) {
    await writeFile(keyTablePath, keyTableContent.trimEnd() + '\n' + keyLine + '\n');
  }

  return { dnsRecord, bindRecord };
}

export async function removeDomain(domain: string, selector: string): Promise<void> {
  const selectorDomain = `${selector}._domainkey.${domain}`;

  // Remove from SigningTable via the round-trip-safe writer, under the
  // per-path mutex. Removes every rule whose keyRef matches selectorDomain
  // (preserves today's substring-match behaviour for legacy duplicates).
  await mutateSigningTable((parsed) => {
    const matchingIds = parsed.lines.flatMap((l) =>
      l.kind === 'rule' && l.keyRef === selectorDomain ? [l.id] : [],
    );
    let nextLines = parsed.lines;
    for (const id of matchingIds) {
      nextLines = removeRule(nextLines, id);
    }
    return { ...parsed, lines: nextLines };
  });

  // Remove from KeyTable — Phase 2 will route this through a round-trip-safe
  // writer. For now the existing substring filter is retained.
  const keyTablePath = join(configDir(), 'KeyTable');
  const keyTableContent = await readFile(keyTablePath, 'utf-8');
  const newKeyTable = keyTableContent
    .split('\n')
    .filter(line => !line.includes(selectorDomain))
    .join('\n');
  await writeFile(keyTablePath, newKeyTable);
}

export async function saveTrustedHosts(hosts: string[]): Promise<void> {
  const hostsPath = join(configDir(), 'TrustedHosts');
  await writeFile(hostsPath, hosts.join('\n') + '\n');
}

export async function reloadService(): Promise<{ success: boolean; message: string }> {
  try {
    const pid = (await readFile(pidFile(), 'utf-8')).trim();
    process.kill(parseInt(pid, 10), 'SIGUSR1');
    return { success: true, message: `Sent SIGUSR1 to OpenDKIM (PID ${pid})` };
  } catch (err) {
    return { success: false, message: `Failed to reload: ${err}` };
  }
}

export async function regenerateKey(domain: string, selector: string): Promise<{ dnsRecord: string; bindRecord: string }> {
  const keyDir = join(configDir(), 'keys', domain);
  const { privateKeyPem, dnsRecord, bindRecord } = await generateDkimKey(domain, selector);

  const keyPath = join(keyDir, `${selector}.private`);
  await writeFile(keyPath, privateKeyPem, { mode: 0o600 });

  const txtPath = join(keyDir, `${selector}.txt`);
  await writeFile(txtPath, bindRecord + '\n', { mode: 0o644 });

  return { dnsRecord, bindRecord };
}

// --- DNS verification ---

export interface DnsExpected {
  recordName: string;   // e.g. mail._domainkey.nextbestnetwork.com
  recordType: string;   // TXT
  expectedValue: string; // v=DKIM1; k=rsa; p=...
}

export async function getExpectedDnsRecord(domain: string, selector: string): Promise<DnsExpected | null> {
  // Derive the expected public key from the stored private key
  const privPath = join(configDir(), 'keys', domain, `${selector}.private`);
  try {
    const privPem = await readFile(privPath, 'utf-8');
    const pubKey = createPublicKey(privPem);
    const pubPem = pubKey.export({ type: 'spki', format: 'pem' }) as string;
    const pubBase64 = pubPemToBase64(pubPem);

    return {
      recordName: `${selector}._domainkey.${domain}`,
      recordType: 'TXT',
      expectedValue: formatDkimDnsValue(pubBase64),
    };
  } catch {
    return null;
  }
}

export interface DnsVerification {
  domain: string;
  selector: string;
  recordName: string;
  expected: DnsExpected | null;
  liveValue: string | null;
  status: 'valid' | 'mismatch' | 'missing' | 'no_key';
  detail: string;
}

export async function verifyDns(domain: string, selector: string): Promise<DnsVerification> {
  const recordName = `${selector}._domainkey.${domain}`;
  const expected = await getExpectedDnsRecord(domain, selector);

  if (!expected) {
    return {
      domain, selector, recordName,
      expected: null, liveValue: null,
      status: 'no_key',
      detail: 'No private key found on disk to derive expected public key.',
    };
  }

  let liveValue: string | null = null;
  try {
    const records = await resolveTxt(recordName);
    // TXT records may be split across multiple strings — join them
    liveValue = records.map(chunks => chunks.join('')).join('');
  } catch {
    return {
      domain, selector, recordName,
      expected, liveValue: null,
      status: 'missing',
      detail: `No TXT record found for ${recordName}. Add the expected record to DNS.`,
    };
  }

  // Normalize whitespace for comparison
  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
  if (normalize(liveValue).includes(normalize(expected.expectedValue))) {
    return {
      domain, selector, recordName,
      expected, liveValue,
      status: 'valid',
      detail: 'DNS TXT record matches the expected public key.',
    };
  }

  // Check if at least p= value matches (handles minor formatting differences)
  const expectedP = expected.expectedValue.match(/p=([A-Za-z0-9+/=]+)/)?.[1] || '';
  if (expectedP && normalize(liveValue).includes(normalize(expectedP))) {
    return {
      domain, selector, recordName,
      expected, liveValue,
      status: 'valid',
      detail: 'DNS TXT record public key matches.',
    };
  }

  return {
    domain, selector, recordName,
    expected, liveValue,
    status: 'mismatch',
    detail: 'DNS TXT record exists but the public key does not match the private key on disk. The key may have been regenerated without updating DNS.',
  };
}
