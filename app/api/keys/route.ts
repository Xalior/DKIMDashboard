import { NextResponse } from 'next/server';
import { getDomains, listKeyFiles } from '@/lib/opendkim';

export async function GET() {
  try {
    const domains = await getDomains();
    const keysInfo = await Promise.all(
      domains.map(async (d) => {
        const files = await listKeyFiles(d.domain);
        return {
          domain: d.domain,
          selector: d.selector,
          keyPath: d.keyPath,
          files,
        };
      })
    );
    return NextResponse.json(keysInfo);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
