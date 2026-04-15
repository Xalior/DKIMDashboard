import {
  listEntries,
  parseKeyTable,
  readKeyTableRaw,
  type KeyEntry,
} from '@/lib/key-table';
import {
  getExpectedDnsRecord,
  listKeyFiles,
  verifyDns,
  type DnsExpected,
  type DnsVerification,
} from '@/lib/opendkim';
import { NotFoundError } from '@/lib/errors';
import { errorResponse } from '@/lib/api-errors';

type Context = { params: Promise<{ id: string }> };

export interface KeyEntryDetail {
  entry: KeyEntry;
  diskFiles: string[] | null;
  dnsExpected: DnsExpected | null;
  dnsVerification: DnsVerification | null;
}

export async function GET(_req: Request, ctx: Context): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const parsed = parseKeyTable(await readKeyTableRaw());
    const entry = listEntries(parsed.lines).find((e) => e.id === id);
    if (!entry) throw new NotFoundError(id);

    if (entry.malformed) {
      // Malformed entry: we can only surface the raw line. Nothing else is
      // safe to derive without guessing the shape.
      const body: KeyEntryDetail = {
        entry,
        diskFiles: null,
        dnsExpected: null,
        dnsVerification: null,
      };
      return Response.json(body);
    }

    const [diskFiles, dnsExpected, dnsVerification] = await Promise.all([
      listKeyFiles(entry.domain),
      getExpectedDnsRecord(entry.domain, entry.selector),
      verifyDns(entry.domain, entry.selector),
    ]);

    const body: KeyEntryDetail = {
      entry,
      diskFiles,
      dnsExpected,
      dnsVerification,
    };
    return Response.json(body);
  } catch (err) {
    return errorResponse(err);
  }
}
