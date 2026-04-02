import { NextRequest, NextResponse } from 'next/server';
import { getDomains, getExpectedDnsRecord, verifyDns } from '@/lib/opendkim';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  const selector = searchParams.get('selector');

  try {
    // Single domain verification
    if (domain && selector) {
      const result = await verifyDns(domain, selector);
      return NextResponse.json(result);
    }

    // All domains — return expected records + verification
    const domains = await getDomains();
    const results = await Promise.all(
      domains.map(async (d) => {
        const expected = await getExpectedDnsRecord(d.domain, d.selector);
        const verification = await verifyDns(d.domain, d.selector);
        return {
          ...d,
          expected,
          verification,
        };
      })
    );
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
