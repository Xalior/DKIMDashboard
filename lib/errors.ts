export type DuplicateEntryKind = 'signing-rule' | 'key-entry' | 'trusted-host';

export class DuplicateEntryError extends Error {
  readonly code = 'DUPLICATE_ENTRY' as const;
  readonly kind: DuplicateEntryKind;
  readonly value: string;

  constructor(kind: DuplicateEntryKind, value: string, message?: string) {
    super(message ?? `Duplicate ${kind}: ${value}`);
    this.name = 'DuplicateEntryError';
    this.kind = kind;
    this.value = value;
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly id: string;

  constructor(id: string, message?: string) {
    super(message ?? `Not found: ${id}`);
    this.name = 'NotFoundError';
    this.id = id;
  }
}
