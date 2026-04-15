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
import {
  parseKeyTable as parseKeyTableV2,
  listEntries,
  addEntry,
  removeEntry,
  mutateKeyTable,
} from './key-table';
import {
  parseTrustedHosts as parseTrustedHostsV2,
  listEntries as listTrustedHostEntries,
} from './trusted-hosts';
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
  id: string;            // signing-rule id (stable across restarts, changes on edit)
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

/**
 * Legacy projection of KeyTable content to the pre-Phase-2 shape.
 * New code should prefer `listEntries(parseKeyTableV2(raw).lines)` from
 * `./key-table`, which preserves ids, malformed entries, and the full
 * round-trip model. Retained for any remaining callers that expect the
 * old shape.
 */
export function parseKeyTable(content: string): { selectorDomain: string; domain: string; selector: string; keyPath: string }[] {
  return listEntries(parseKeyTableV2(content).lines)
    .filter((e) => !e.malformed)
    .map(({ selectorDomain, domain, selector, keyPath }) => ({
      selectorDomain,
      domain,
      selector,
      keyPath,
    }));
}

/**
 * Legacy projection of TrustedHosts content to the pre-Phase-3 shape.
 * New code should prefer `listEntries(parseTrustedHostsV2(raw).lines)` from
 * `./trusted-hosts`, which preserves ids, inline comments, `refile:` flags
 * and the full round-trip model.
 */
export function parseTrustedHosts(content: string): TrustedHost[] {
  return listTrustedHostEntries(parseTrustedHostsV2(content).lines).map(({ value }) => ({ value }));
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
  const keys = listEntries(parseKeyTableV2(keyRaw).lines).filter((e) => !e.malformed);

  return rules.map((r) => {
    const k = keys.find((k) => k.selectorDomain === r.keyRef);
    return {
      id: r.id,
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

  // Append to KeyTable via the round-trip-safe writer. Idempotent: if an
  // entry with this selectorDomain already exists, skip (matches the
  // pre-refactor .includes() check).
  const canonicalKeyPath = join(CANONICAL_CONFIG_DIR, 'keys', domain, `${selector}.private`);
  try {
    await mutateKeyTable((parsed) => ({
      ...parsed,
      lines: addEntry(parsed.lines, {
        selectorDomain,
        domain,
        selector,
        keyPath: canonicalKeyPath,
      }),
    }));
  } catch (err) {
    if (!(err instanceof DuplicateEntryError)) throw err;
    // Entry with this selectorDomain already present — no-op. Matches
    // legacy .includes()-based skip.
  }

  return { dnsRecord, bindRecord };
}

/**
 * Remove a domain's rule(s) and — when the last referencing rule is
 * removed — its KeyTable entry.
 *
 * `ruleId` optional:
 * - When supplied, only that specific SigningTable rule is removed. If other
 *   rules still reference this `selectorDomain`, the KeyTable entry stays
 *   (the key is still in use). This is the narrow per-rule semantics the
 *   `/domains` UI uses — required so that one-of-two rules for the same
 *   `(domain, selector)` can be removed without silently taking the other
 *   with it.
 * - When omitted, every SigningTable rule matching this `selectorDomain` is
 *   removed (legacy domain-wide delete); KeyTable is always removed.
 *
 * Key files on disk are never deleted automatically (documented UX).
 */
export async function removeDomain(
  domain: string,
  selector: string,
  ruleId?: string,
): Promise<void> {
  const selectorDomain = `${selector}._domainkey.${domain}`;

  const postSigning = await mutateSigningTable((parsed) => {
    let nextLines = parsed.lines;
    if (ruleId) {
      nextLines = removeRule(nextLines, ruleId);
    } else {
      const matchingIds = parsed.lines.flatMap((l) =>
        l.kind === 'rule' && l.keyRef === selectorDomain ? [l.id] : [],
      );
      for (const id of matchingIds) {
        nextLines = removeRule(nextLines, id);
      }
    }
    return { ...parsed, lines: nextLines };
  });

  const stillReferenced = listRules(postSigning.lines).some(
    (r) => r.keyRef === selectorDomain,
  );
  if (stillReferenced) {
    // Key still used by another rule — KeyTable entry + key files stay.
    return;
  }

  // No more references: remove the KeyTable entry via the round-trip-safe writer.
  await mutateKeyTable((parsed) => {
    const matchingIds = parsed.lines.flatMap((l) =>
      l.kind === 'entry' && l.selectorDomain === selectorDomain ? [l.id] : [],
    );
    let nextLines = parsed.lines;
    for (const id of matchingIds) {
      nextLines = removeEntry(nextLines, id);
    }
    return { ...parsed, lines: nextLines };
  });
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
