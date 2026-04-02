import { NextResponse } from 'next/server';
import { reloadService } from '@/lib/opendkim';

export async function POST() {
  try {
    const result = await reloadService();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
