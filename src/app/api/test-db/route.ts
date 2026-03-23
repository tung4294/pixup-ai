import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const url = process.env.DATABASE_URL;
    return NextResponse.json({ success: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack });
  }
}
