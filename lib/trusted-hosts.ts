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

export type TrustedHostsLine =
  | {
      kind: 'entry';
      id: string;
      value: string;
      inlineComment?: string;
      rawLine?: string;
      leading: PreambleLine[];
    }
  | {
      kind: 'trailing';
      lines: PreambleLine[];
    };

export interface TrustedHostEntry {
  id: string;
  value: string;
  isRefile: boolean;
  inlineComment?: string;
}

export interface ParsedTrustedHosts {
  lines: TrustedHostsLine[];
  eol: '\n' | '\r\n';
  hasFinalNewline: boolean;
}

// --- ID generation ---

function makeBaseId(value: string): string {
  return createHash('sha256').update(value).digest('base64url').slice(0, 12);
}

// --- Parse / serialize ---

/**
 * Split a trimmed non-empty non-comment line into `(value, inlineComment?)`.
 * TrustedHosts entries are single-token; any whitespace-separated trailing
 * `#...` on the same line is captured as an inline comment. Value tokens may
 * themselves contain `#` without a leading space (e.g. a `refile:/path#foo`
 * shouldn't be confused with an inline comment); we only cut at a `#` that
 * follows whitespace.
 */
function splitEntryTokens(trimmedLine: string): { value: string; inlineComment?: string } {
  const m = trimmedLine.match(/^(\S+)(?:\s+(#.*))?$/);
  if (m) {
    return m[2] ? { value: m[1], inlineComment: m[2] } : { value: m[1] };
  }
  // Line has multiple non-#-leading tokens; OpenDKIM would likely ignore
  // everything after the first token, but we preserve the full string as
  // the value (round-trip via rawLine stays correct regardless).
  return { value: trimmedLine };
}

export function parseTrustedHosts(content: string): ParsedTrustedHosts {
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

  const out: TrustedHostsLine[] = [];
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

    const { value, inlineComment } = splitEntryTokens(trimmed);

    const baseId = makeBaseId(value);
    const count = idOccurrences.get(baseId) ?? 0;
    idOccurrences.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count + 1}`;

    const entry: TrustedHostsLine = {
      kind: 'entry',
      id,
      value,
      rawLine: line,
      leading,
      ...(inlineComment !== undefined ? { inlineComment } : {}),
    };
    out.push(entry);
    leading = [];
  }

  if (leading.length > 0) {
    out.push({ kind: 'trailing', lines: leading });
  }

  return { lines: out, eol, hasFinalNewline };
}

function canonicalEntryLine(value: string, inlineComment: string | undefined): string {
  return inlineComment !== undefined ? `${value} ${inlineComment}` : value;
}

export function serializeTrustedHosts(parsed: ParsedTrustedHosts): string {
  const parts: string[] = [];
  for (const line of parsed.lines) {
    if (line.kind === 'entry') {
      for (const p of line.leading) parts.push(p.content);
      parts.push(line.rawLine !== undefined ? line.rawLine : canonicalEntryLine(line.value, line.inlineComment));
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

export function listEntries(lines: TrustedHostsLine[]): TrustedHostEntry[] {
  const out: TrustedHostEntry[] = [];
  for (const line of lines) {
    if (line.kind === 'entry') {
      out.push({
        id: line.id,
        value: line.value,
        isRefile: line.value.startsWith('refile:'),
        ...(line.inlineComment !== undefined ? { inlineComment: line.inlineComment } : {}),
      });
    }
  }
  return out;
}

// --- CRUD ---

export interface AddEntryInput {
  value: string;
  /** Insert position among entries; undefined = append at end (before trailing). */
  position?: number;
}

export function addEntry(lines: TrustedHostsLine[], input: AddEntryInput): TrustedHostsLine[] {
  const { value } = input;

  for (const line of lines) {
    if (line.kind === 'entry' && line.value === value) {
      throw new DuplicateEntryError('trusted-host', value);
    }
  }

  const newEntry: TrustedHostsLine = {
    kind: 'entry',
    id: makeBaseId(value),
    value,
    leading: [],
  };

  const entryIndices: number[] = [];
  let trailingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === 'entry') entryIndices.push(i);
    else if (l.kind === 'trailing') trailingIdx = i;
  }

  let insertAt: number;
  if (input.position === undefined || input.position >= entryIndices.length) {
    insertAt = trailingIdx === -1 ? lines.length : trailingIdx;
  } else if (input.position <= 0) {
    insertAt = entryIndices[0] ?? 0;
  } else {
    insertAt = entryIndices[input.position];
  }

  const next = lines.slice();
  next.splice(insertAt, 0, newEntry);
  return next;
}

export interface UpdateEntryInput {
  value: string;
  /**
   * Optional explicit inline-comment override. If omitted, the existing
   * entry's inline comment (if any) is preserved through the edit — this
   * is the deviation from the original plan's drop-on-edit stance.
   * Pass an empty string to explicitly drop the inline comment.
   */
  inlineComment?: string;
}

export function updateEntry(
  lines: TrustedHostsLine[],
  id: string,
  input: UpdateEntryInput,
): TrustedHostsLine[] {
  const idx = lines.findIndex((l) => l.kind === 'entry' && l.id === id);
  if (idx === -1) throw new NotFoundError(id);

  const { value } = input;

  // Collision check against other entries' value.
  for (let i = 0; i < lines.length; i++) {
    if (i === idx) continue;
    const l = lines[i];
    if (l.kind === 'entry' && l.value === value) {
      throw new DuplicateEntryError('trusted-host', value);
    }
  }

  const existing = lines[idx] as Extract<TrustedHostsLine, { kind: 'entry' }>;

  // Inline comment handling deviates from the original plan:
  // default to preserving the existing comment across edits; caller can
  // override by passing inlineComment (empty string => drop; any other
  // string => replace).
  let nextInlineComment: string | undefined;
  if (input.inlineComment === undefined) {
    nextInlineComment = existing.inlineComment;
  } else if (input.inlineComment === '') {
    nextInlineComment = undefined;
  } else {
    nextInlineComment = input.inlineComment;
  }

  const updated: TrustedHostsLine = {
    kind: 'entry',
    id: makeBaseId(value),
    value,
    leading: existing.leading,
    ...(nextInlineComment !== undefined ? { inlineComment: nextInlineComment } : {}),
    // rawLine intentionally omitted — serializer emits canonical form for edits.
  };

  const next = lines.slice();
  next[idx] = updated;
  return next;
}

export function removeEntry(lines: TrustedHostsLine[], id: string): TrustedHostsLine[] {
  const idx = lines.findIndex((l) => l.kind === 'entry' && l.id === id);
  if (idx === -1) throw new NotFoundError(id);
  const next = lines.slice();
  next.splice(idx, 1);
  return next;
}

// --- Persistence ---

function trustedHostsPath(): string {
  const dir = process.env.OPENDKIM_CONFIG_DIR || '/etc/opendkim';
  return join(dir, 'TrustedHosts');
}

export async function readTrustedHostsRaw(): Promise<string> {
  return readFile(trustedHostsPath(), 'utf-8');
}

export async function saveTrustedHosts(parsed: ParsedTrustedHosts): Promise<void> {
  const path = trustedHostsPath();
  await withLock(path, () => writeFileAtomic(path, serializeTrustedHosts(parsed)));
}

/**
 * Atomic read-modify-write of the on-disk TrustedHosts. Matches the pattern
 * from mutateSigningTable / mutateKeyTable.
 */
export async function mutateTrustedHosts(
  mutator: (parsed: ParsedTrustedHosts) => ParsedTrustedHosts,
): Promise<ParsedTrustedHosts> {
  const path = trustedHostsPath();
  return withLock(path, async () => {
    const raw = await readFile(path, 'utf-8');
    const parsed = parseTrustedHosts(raw);
    const next = mutator(parsed);
    await writeFileAtomic(path, serializeTrustedHosts(next));
    return next;
  });
}
