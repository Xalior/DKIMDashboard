import { NextRequest, NextResponse } from 'next/server';
import { getDomains, addDomain, removeDomain, getDnsRecord } from '@/lib/opendkim';

export async function GET() {
  try {
    const domains = await getDomains();
    const domainsWithDns = await Promise.all(
      domains.map(async (d) => {
        const dnsRecord = await getDnsRecord(d.domain, d.selector);
        return { ...d, dnsRecord };
      })
    );
    return NextResponse.json(domainsWithDns);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { domain, selector, fromPattern } = await req.json();
    if (!domain || !selector || !fromPattern) {
      return NextResponse.json({ error: 'domain, selector, and fromPattern are required' }, { status: 400 });
    }
    const result = await addDomain(domain, selector, fromPattern);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { domain, selector, ruleId } = await req.json();
    if (!domain || !selector) {
      return NextResponse.json({ error: 'domain and selector are required' }, { status: 400 });
    }
    if (ruleId !== undefined && typeof ruleId !== 'string') {
      return NextResponse.json({ error: 'ruleId, if provided, must be a string' }, { status: 400 });
    }
    await removeDomain(domain, selector, ruleId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
