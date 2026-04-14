import {
  listEntries,
  mutateTrustedHosts,
  parseTrustedHosts,
  readTrustedHostsRaw,
  removeEntry,
  updateEntry,
  type TrustedHostEntry,
} from '@/lib/trusted-hosts';
import { NotFoundError } from '@/lib/errors';
import { errorResponse, ValidationError } from '@/lib/api-errors';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const parsed = parseTrustedHosts(await readTrustedHostsRaw());
    const entry = listEntries(parsed.lines).find((e) => e.id === id);
    if (!entry) throw new NotFoundError(id);
    return Response.json({ entry });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { value, inlineComment } = body as { value?: unknown; inlineComment?: unknown };

    if (typeof value !== 'string' || value.trim() === '') {
      throw new ValidationError('value is required and must be a non-empty string');
    }
    if (inlineComment !== undefined && typeof inlineComment !== 'string') {
      throw new ValidationError('inlineComment, if provided, must be a string');
    }

    const postState = await mutateTrustedHosts((parsed) => ({
      ...parsed,
      lines: updateEntry(parsed.lines, id, {
        value,
        ...(inlineComment !== undefined ? { inlineComment: inlineComment as string } : {}),
      }),
    }));

    const entry: TrustedHostEntry | undefined = listEntries(postState.lines).find(
      (e) => e.value === value,
    );
    if (!entry) throw new Error('internal: updated trusted host not found in post-state');
    return Response.json({ entry });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    await mutateTrustedHosts((parsed) => ({
      ...parsed,
      lines: removeEntry(parsed.lines, id),
    }));
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
