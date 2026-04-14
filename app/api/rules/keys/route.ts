import {
  listEntries,
  parseKeyTable,
  readKeyTableRaw,
  type KeyEntry,
} from '@/lib/key-table';
import { errorResponse } from '@/lib/api-errors';

export async function GET(): Promise<Response> {
  try {
    const parsed = parseKeyTable(await readKeyTableRaw());
    const entries: KeyEntry[] = listEntries(parsed.lines);
    return Response.json(entries);
  } catch (err) {
    return errorResponse(err);
  }
}
