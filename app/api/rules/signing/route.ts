import {
  addRule,
  listRules,
  mutateSigningTable,
  parseSigningTable,
  readSigningTableRaw,
  reorderRules,
  type SigningRule,
} from '@/lib/signing-table';
import { errorResponse, ValidationError } from '@/lib/api-errors';

export async function GET(): Promise<Response> {
  try {
    const parsed = parseSigningTable(await readSigningTableRaw());
    const rules = listRules(parsed.lines);
    return Response.json(rules);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { pattern, keyRef, position } = body as {
      pattern?: unknown;
      keyRef?: unknown;
      position?: unknown;
    };

    if (typeof pattern !== 'string' || pattern.trim() === '') {
      throw new ValidationError('pattern is required and must be a non-empty string');
    }
    if (typeof keyRef !== 'string' || keyRef.trim() === '') {
      throw new ValidationError('keyRef is required and must be a non-empty string');
    }
    if (position !== undefined && (typeof position !== 'number' || !Number.isFinite(position))) {
      throw new ValidationError('position, if provided, must be a finite number');
    }

    const postState = await mutateSigningTable((parsed) => ({
      ...parsed,
      lines: addRule(parsed.lines, {
        pattern,
        keyRef,
        ...(position !== undefined ? { position: position as number } : {}),
      }),
    }));

    const rule: SigningRule | undefined = listRules(postState.lines).find(
      (r) => r.pattern === pattern && r.keyRef === keyRef,
    );
    if (!rule) {
      // Should never happen — addRule would have thrown on a collision, and
      // on success the new rule is present in the parsed state.
      throw new Error('internal: newly added rule not found in post-state');
    }
    return Response.json({ rule }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { order } = body as { order?: unknown };

    if (!Array.isArray(order) || !order.every((id) => typeof id === 'string')) {
      throw new ValidationError('order is required and must be an array of strings');
    }

    const postState = await mutateSigningTable((parsed) => ({
      ...parsed,
      lines: reorderRules(parsed.lines, order as string[]),
    }));

    const rules = listRules(postState.lines);
    return Response.json({ rules });
  } catch (err) {
    return errorResponse(err);
  }
}
