import { NextResponse } from 'next/server';
import { readConfig, readSigningTable, readKeyTable } from '@/lib/opendkim';

export async function GET() {
  try {
    const [config, signingTable, keyTable] = await Promise.all([
      readConfig(),
      readSigningTable(),
      readKeyTable(),
    ]);
    return NextResponse.json({ config, signingTable, keyTable });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
