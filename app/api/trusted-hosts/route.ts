import { NextRequest, NextResponse } from 'next/server';
import { readTrustedHosts, parseTrustedHosts, saveTrustedHosts } from '@/lib/opendkim';

export async function GET() {
  try {
    const raw = await readTrustedHosts();
    const hosts = parseTrustedHosts(raw);
    return NextResponse.json(hosts);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { hosts } = await req.json();
    if (!Array.isArray(hosts)) {
      return NextResponse.json({ error: 'hosts must be an array of strings' }, { status: 400 });
    }
    await saveTrustedHosts(hosts);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
