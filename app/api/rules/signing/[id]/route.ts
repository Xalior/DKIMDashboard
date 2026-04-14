import {
  listRules,
  mutateSigningTable,
  parseSigningTable,
  readSigningTableRaw,
  removeRule,
  updateRule,
  type SigningRule,
} from '@/lib/signing-table';
import { NotFoundError } from '@/lib/errors';
import { errorResponse, ValidationError } from '@/lib/api-errors';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const parsed = parseSigningTable(await readSigningTableRaw());
    const rule = listRules(parsed.lines).find((r) => r.id === id);
    if (!rule) throw new NotFoundError(id);
    return Response.json({ rule });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { pattern, keyRef } = body as { pattern?: unknown; keyRef?: unknown };

    if (typeof pattern !== 'string' || pattern.trim() === '') {
      throw new ValidationError('pattern is required and must be a non-empty string');
    }
    if (typeof keyRef !== 'string' || keyRef.trim() === '') {
      throw new ValidationError('keyRef is required and must be a non-empty string');
    }

    const postState = await mutateSigningTable((parsed) => ({
      ...parsed,
      lines: updateRule(parsed.lines, id, { pattern, keyRef }),
    }));

    const rule: SigningRule | undefined = listRules(postState.lines).find(
      (r) => r.pattern === pattern && r.keyRef === keyRef,
    );
    if (!rule) throw new Error('internal: updated rule not found in post-state');
    return Response.json({ rule });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    await mutateSigningTable((parsed) => ({
      ...parsed,
      lines: removeRule(parsed.lines, id),
    }));
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
