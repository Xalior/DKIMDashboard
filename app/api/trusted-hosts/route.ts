import {
  addEntry,
  listEntries,
  mutateTrustedHosts,
  parseTrustedHosts,
  readTrustedHostsRaw,
  type TrustedHostEntry,
} from '@/lib/trusted-hosts';
import { errorResponse, ValidationError } from '@/lib/api-errors';

export async function GET(): Promise<Response> {
  try {
    const parsed = parseTrustedHosts(await readTrustedHostsRaw());
    const entries = listEntries(parsed.lines);
    return Response.json(entries);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { value, position } = body as { value?: unknown; position?: unknown };

    if (typeof value !== 'string' || value.trim() === '') {
      throw new ValidationError('value is required and must be a non-empty string');
    }
    if (/[\s,]/.test(value)) {
      throw new ValidationError(
        'value must not contain whitespace or commas — add multiple entries one at a time',
      );
    }
    if (position !== undefined && (typeof position !== 'number' || !Number.isFinite(position))) {
      throw new ValidationError('position, if provided, must be a finite number');
    }

    const postState = await mutateTrustedHosts((parsed) => ({
      ...parsed,
      lines: addEntry(parsed.lines, {
        value,
        ...(position !== undefined ? { position: position as number } : {}),
      }),
    }));

    const entry: TrustedHostEntry | undefined = listEntries(postState.lines).find(
      (e) => e.value === value,
    );
    if (!entry) throw new Error('internal: newly added trusted host not found in post-state');
    return Response.json({ entry }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
