import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';

import { writeFileAtomic } from './atomic-fs';
import { withLock } from './write-lock';
import { DuplicateEntryError, NotFoundError } from './errors';

// --- Types ---

export type PreambleKind = 'comment' | 'blank' | 'other';

export interface PreambleLine {
  content: string;
  kind: PreambleKind;
}

export type KeyTableLine =
  | {
      kind: 'entry';
      id: string;
      selectorDomain: string;
      domain: string;
      selector: string;
      keyPath: string;
      rawLine?: string;
      leading: PreambleLine[];
    }
  | {
      kind: 'entry-malformed';
      id: string;
      rawLine: string;
      leading: PreambleLine[];
    }
  | {
      kind: 'trailing';
      lines: PreambleLine[];
    };

/**
 * Consumer-facing projection. Malformed entries still appear in `listEntries`
 * with `malformed: true` — the UI decides how to display them; the parser's
 * job is only to preserve them faithfully for round-trip.
 */
export interface KeyEntry {
  id: string;
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
  malformed: boolean;
  rawLine: string;
}

export interface ParsedKeyTable {
  lines: KeyTableLine[];
  eol: '\n' | '\r\n';
  hasFinalNewline: boolean;
}

// --- ID generation ---

function makeBaseId(selectorDomain: string, domain: string, selector: string, keyPath: string): string {
  return createHash('sha256')
    .update(`${selectorDomain}\0${domain}\0${selector}\0${keyPath}`)
    .digest('base64url')
    .slice(0, 12);
}

function makeMalformedId(rawLine: string): string {
  return createHash('sha256').update(rawLine).digest('base64url').slice(0, 12);
}

// --- Parse / serialize ---

export function parseKeyTable(content: string): ParsedKeyTable {
  const eol: '\n' | '\r\n' = content.includes('\r\n') ? '\r\n' : '\n';
  const hasFinalNewline = content.length > 0 && content.endsWith(eol);

  if (content.length === 0) {
    return { lines: [], eol, hasFinalNewline: false };
  }

  let rawLines = content.split('\n');
  if (eol === '\r\n') {
    rawLines = rawLines.map((l) => (l.endsWith('\r') ? l.slice(0, -1) : l));
  }
  if (hasFinalNewline) {
    rawLines = rawLines.slice(0, -1);
  }

  const out: KeyTableLine[] = [];
  let leading: PreambleLine[] = [];
  const idOccurrences = new Map<string, number>();

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      leading.push({ kind: 'blank', content: line });
      continue;
    }
    if (trimmed.startsWith('#')) {
      leading.push({ kind: 'comment', content: line });
      continue;
    }

    // Entry line. Canonical shape: `selectorDomain  domain:selector:keyPath`
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) {
      // Single-token line — malformed.
      const baseId = makeMalformedId(line);
      const count = idOccurrences.get(baseId) ?? 0;
      idOccurrences.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      out.push({ kind: 'entry-malformed', id, rawLine: line, leading });
      leading = [];
      continue;
    }

    const selectorDomain = parts[0];
    const valueParts = parts[1].split(':');
    if (valueParts.length < 3) {
      const baseId = makeMalformedId(line);
      const count = idOccurrences.get(baseId) ?? 0;
      idOccurrences.set(baseId, count + 1);
      const id = count === 0 ? baseId : `${baseId}-${count + 1}`;
      out.push({ kind: 'entry-malformed', id, rawLine: line, leading });
      leading = [];
      continue;
    }

    const [domain, selector, ...rest] = valueParts;
    // Preserve keyPath even if it contained additional colons (unlikely in
    // POSIX paths, but cheap to handle robustly).
    const keyPath = rest.join(':');

    const baseId = makeBaseId(selectorDomain, domain, selector, keyPath);
    const count = idOccurrences.get(baseId) ?? 0;
    idOccurrences.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    out.push({
      kind: 'entry',
      id,
      selectorDomain,
      domain,
      selector,
      keyPath,
      rawLine: line,
      leading,
    });
    leading = [];
  }

  if (leading.length > 0) {
    out.push({ kind: 'trailing', lines: leading });
  }

  return { lines: out, eol, hasFinalNewline };
}

export function serializeKeyTable(parsed: ParsedKeyTable): string {
  const parts: string[] = [];
  for (const line of parsed.lines) {
    if (line.kind === 'entry') {
      for (const p of line.leading) parts.push(p.content);
      parts.push(
        line.rawLine !== undefined
          ? line.rawLine
          : `${line.selectorDomain} ${line.domain}:${line.selector}:${line.keyPath}`,
      );
    } else if (line.kind === 'entry-malformed') {
      for (const p of line.leading) parts.push(p.content);
      parts.push(line.rawLine);
    } else {
      for (const p of line.lines) parts.push(p.content);
    }
  }
  if (parts.length === 0) {
    return parsed.hasFinalNewline ? parsed.eol : '';
  }
  return parts.join(parsed.eol) + (parsed.hasFinalNewline ? parsed.eol : '');
}

// --- Projections ---

export function listEntries(lines: KeyTableLine[]): KeyEntry[] {
  const out: KeyEntry[] = [];
  for (const line of lines) {
    if (line.kind === 'entry') {
      out.push({
        id: line.id,
        selectorDomain: line.selectorDomain,
        domain: line.domain,
        selector: line.selector,
        keyPath: line.keyPath,
        malformed: false,
        rawLine: line.rawLine ?? `${line.selectorDomain} ${line.domain}:${line.selector}:${line.keyPath}`,
      });
    } else if (line.kind === 'entry-malformed') {
      out.push({
        id: line.id,
        selectorDomain: '',
        domain: '',
        selector: '',
        keyPath: '',
        malformed: true,
        rawLine: line.rawLine,
      });
    }
  }
  return out;
}

// --- CRUD ---

export interface AddEntryInput {
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
}

export function addEntry(lines: KeyTableLine[], input: AddEntryInput): KeyTableLine[] {
  const { selectorDomain, domain, selector, keyPath } = input;

  // KeyTable is a lookup map keyed by selectorDomain — a duplicate key would
  // make the second entry dead code as OpenDKIM uses the first match.
  for (const line of lines) {
    if (line.kind === 'entry' && line.selectorDomain === selectorDomain) {
      throw new DuplicateEntryError('key-entry', selectorDomain);
    }
  }

  const newEntry: KeyTableLine = {
    kind: 'entry',
    id: makeBaseId(selectorDomain, domain, selector, keyPath),
    selectorDomain,
    domain,
    selector,
    keyPath,
    leading: [],
  };

  // Insert before trailing if present, else append.
  const trailingIdx = lines.findIndex((l) => l.kind === 'trailing');
  const insertAt = trailingIdx === -1 ? lines.length : trailingIdx;

  const next = lines.slice();
  next.splice(insertAt, 0, newEntry);
  return next;
}

export interface UpdateEntryInput {
  selectorDomain: string;
  domain: string;
  selector: string;
  keyPath: string;
}

export function updateEntry(
  lines: KeyTableLine[],
  id: string,
  input: UpdateEntryInput,
): KeyTableLine[] {
  const idx = lines.findIndex((l) => (l.kind === 'entry' || l.kind === 'entry-malformed') && l.id === id);
  if (idx === -1) throw new NotFoundError(id);

  const { selectorDomain, domain, selector, keyPath } = input;

  // Collision check against other entries' selectorDomain.
  for (let i = 0; i < lines.length; i++) {
    if (i === idx) continue;
    const l = lines[i];
    if (l.kind === 'entry' && l.selectorDomain === selectorDomain) {
      throw new DuplicateEntryError('key-entry', selectorDomain);
    }
  }

  const existing = lines[idx];
  const leading =
    existing.kind === 'entry' || existing.kind === 'entry-malformed' ? existing.leading : [];

  const updated: KeyTableLine = {
    kind: 'entry',
    id: makeBaseId(selectorDomain, domain, selector, keyPath),
    selectorDomain,
    domain,
    selector,
    keyPath,
    leading,
    // rawLine intentionally omitted — canonical re-emit.
  };

  const next = lines.slice();
  next[idx] = updated;
  return next;
}

export function removeEntry(lines: KeyTableLine[], id: string): KeyTableLine[] {
  const idx = lines.findIndex(
    (l) => (l.kind === 'entry' || l.kind === 'entry-malformed') && l.id === id,
  );
  if (idx === -1) throw new NotFoundError(id);
  const next = lines.slice();
  next.splice(idx, 1);
  return next;
}

// --- Persistence ---

function keyTablePath(): string {
  const dir = process.env.OPENDKIM_CONFIG_DIR || '/etc/opendkim';
  return join(dir, 'KeyTable');
}

export async function readKeyTableRaw(): Promise<string> {
  return readFile(keyTablePath(), 'utf-8');
}

export async function saveKeyTable(parsed: ParsedKeyTable): Promise<void> {
  const path = keyTablePath();
  await withLock(path, () => writeFileAtomic(path, serializeKeyTable(parsed)));
}

/**
 * Atomic read-modify-write of the on-disk KeyTable. Matches mutateSigningTable's
 * contract: the whole cycle runs under the per-path async lock so concurrent
 * in-process requests serialise rather than racing on a read-then-write window.
 */
export async function mutateKeyTable(
  mutator: (parsed: ParsedKeyTable) => ParsedKeyTable,
): Promise<ParsedKeyTable> {
  const path = keyTablePath();
  return withLock(path, async () => {
    const raw = await readFile(path, 'utf-8');
    const parsed = parseKeyTable(raw);
    const next = mutator(parsed);
    await writeFileAtomic(path, serializeKeyTable(next));
    return next;
  });
}
