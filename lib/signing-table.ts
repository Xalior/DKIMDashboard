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

export type SigningTableLine =
  | {
      kind: 'rule';
      id: string;
      pattern: string;
      keyRef: string;
      rawLine?: string;
      leading: PreambleLine[];
    }
  | {
      kind: 'trailing';
      lines: PreambleLine[];
    };

export interface SigningRule {
  id: string;
  pattern: string;
  keyRef: string;
}

/**
 * Round-trip-preserving representation of a SigningTable file.
 *
 * `lines` is the logical content; `eol` and `hasFinalNewline` together
 * encode the trailing-byte details so `serialize(parse(f)) === f` byte-for-byte.
 */
export interface ParsedSigningTable {
  lines: SigningTableLine[];
  eol: '\n' | '\r\n';
  hasFinalNewline: boolean;
}

// --- ID generation ---

function makeBaseId(pattern: string, keyRef: string): string {
  return createHash('sha256').update(`${pattern}\0${keyRef}`).digest('base64url').slice(0, 12);
}

// --- Parse / serialize ---

export function parseSigningTable(content: string): ParsedSigningTable {
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

  const out: SigningTableLine[] = [];
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

    // Rule line — canonical (2+ tokens) or malformed (1 token, keyRef='').
    const parts = trimmed.split(/\s+/);
    const pattern = parts[0];
    const keyRef = parts[1] ?? '';
    const baseId = makeBaseId(pattern, keyRef);
    const count = idOccurrences.get(baseId) ?? 0;
    idOccurrences.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    out.push({
      kind: 'rule',
      id,
      pattern,
      keyRef,
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

export function serializeSigningTable(parsed: ParsedSigningTable): string {
  const parts: string[] = [];
  for (const line of parsed.lines) {
    if (line.kind === 'rule') {
      for (const p of line.leading) parts.push(p.content);
      parts.push(line.rawLine !== undefined ? line.rawLine : `${line.pattern} ${line.keyRef}`);
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

export function listRules(lines: SigningTableLine[]): SigningRule[] {
  const out: SigningRule[] = [];
  for (const line of lines) {
    if (line.kind === 'rule') {
      out.push({ id: line.id, pattern: line.pattern, keyRef: line.keyRef });
    }
  }
  return out;
}

// --- CRUD ---

export interface AddRuleInput {
  pattern: string;
  keyRef: string;
  /** Insert position among rules; undefined = append at end (before trailing). */
  position?: number;
}

export function addRule(lines: SigningTableLine[], input: AddRuleInput): SigningTableLine[] {
  const { pattern, keyRef } = input;

  for (const line of lines) {
    if (line.kind === 'rule' && line.pattern === pattern && line.keyRef === keyRef) {
      throw new DuplicateEntryError('signing-rule', `${pattern} ${keyRef}`);
    }
  }

  const newRule: SigningTableLine = {
    kind: 'rule',
    id: makeBaseId(pattern, keyRef),
    pattern,
    keyRef,
    leading: [],
  };

  const ruleIndices: number[] = [];
  let trailingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'rule') ruleIndices.push(i);
    else if (l.kind === 'trailing') trailingIdx = i;
  }

  let insertAt: number;
  if (input.position === undefined || input.position >= ruleIndices.length) {
    insertAt = trailingIdx === -1 ? lines.length : trailingIdx;
  } else if (input.position <= 0) {
    insertAt = ruleIndices[0] ?? 0;
  } else {
    insertAt = ruleIndices[input.position];
  }

  const next = lines.slice();
  next.splice(insertAt, 0, newRule);
  return next;
}

export interface UpdateRuleInput {
  pattern: string;
  keyRef: string;
}

export function updateRule(
  lines: SigningTableLine[],
  id: string,
  input: UpdateRuleInput,
): SigningTableLine[] {
  const idx = lines.findIndex((l) => l.kind === 'rule' && l.id === id);
  if (idx === -1) throw new NotFoundError(id);

  const { pattern, keyRef } = input;

  for (let i = 0; i < lines.length; i++) {
    if (i === idx) continue;
    const l = lines[i];
    if (l.kind === 'rule' && l.pattern === pattern && l.keyRef === keyRef) {
      throw new DuplicateEntryError('signing-rule', `${pattern} ${keyRef}`);
    }
  }

  const existing = lines[idx] as Extract<SigningTableLine, { kind: 'rule' }>;
  const updated: SigningTableLine = {
    kind: 'rule',
    id: makeBaseId(pattern, keyRef),
    pattern,
    keyRef,
    leading: existing.leading,
    // rawLine intentionally omitted — serializer emits canonical form for mutated rules.
  };

  const next = lines.slice();
  next[idx] = updated;
  return next;
}

export function removeRule(lines: SigningTableLine[], id: string): SigningTableLine[] {
  const idx = lines.findIndex((l) => l.kind === 'rule' && l.id === id);
  if (idx === -1) throw new NotFoundError(id);
  const next = lines.slice();
  next.splice(idx, 1);
  return next;
}

export function reorderRules(lines: SigningTableLine[], idList: string[]): SigningTableLine[] {
  const currentRules = lines.filter(
    (l): l is Extract<SigningTableLine, { kind: 'rule' }> => l.kind === 'rule',
  );
  const currentIds = new Set(currentRules.map((r) => r.id));

  if (idList.length !== currentRules.length) {
    throw new Error(
      `reorder: idList length ${idList.length} does not match rule count ${currentRules.length}`,
    );
  }
  if (new Set(idList).size !== idList.length) {
    throw new Error('reorder: idList contains duplicates');
  }
  for (const id of idList) {
    if (!currentIds.has(id)) throw new NotFoundError(id);
  }

  const byId = new Map(currentRules.map((r) => [r.id, r] as const));
  const reordered: SigningTableLine[] = idList.map((id) => byId.get(id)!);

  const trailing = lines.find((l) => l.kind === 'trailing');
  return trailing ? [...reordered, trailing] : reordered;
}

// --- Persistence ---

function signingTablePath(): string {
  const dir = process.env.OPENDKIM_CONFIG_DIR || '/etc/opendkim';
  return join(dir, 'SigningTable');
}

export async function readSigningTableRaw(): Promise<string> {
  return readFile(signingTablePath(), 'utf-8');
}

export async function saveSigningTable(parsed: ParsedSigningTable): Promise<void> {
  const path = signingTablePath();
  await withLock(path, () => writeFileAtomic(path, serializeSigningTable(parsed)));
}

/**
 * Atomic read-modify-write of the on-disk SigningTable.
 *
 * The read, mutator, serialize, and write all run under the same per-path
 * async lock, so concurrent requests within this process see consistent
 * state rather than racing on a read-then-write window.
 *
 * Returns the post-write parsed state, so callers can project the result
 * (e.g. look up the new rule's id) without re-parsing.
 */
export async function mutateSigningTable(
  mutator: (parsed: ParsedSigningTable) => ParsedSigningTable,
): Promise<ParsedSigningTable> {
  const path = signingTablePath();
  return withLock(path, async () => {
    const raw = await readFile(path, 'utf-8');
    const parsed = parseSigningTable(raw);
    const next = mutator(parsed);
    await writeFileAtomic(path, serializeSigningTable(next));
    return next;
  });
}
