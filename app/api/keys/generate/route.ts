import { NextRequest, NextResponse } from 'next/server';
import { regenerateKey } from '@/lib/opendkim';

export async function POST(req: NextRequest) {
  try {
    const { domain, selector } = await req.json();
    if (!domain || !selector) {
      return NextResponse.json({ error: 'domain and selector are required' }, { status: 400 });
    }
    const result = await regenerateKey(domain, selector);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
