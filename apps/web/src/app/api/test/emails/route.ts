import { NextResponse } from 'next/server';

import { isEmailStubEnabled, readEmailStub } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isEmailStubEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({
    messages: readEmailStub().map((message) => ({
      id: message.id,
      to: message.to,
      subject: message.subject,
      text: message.text,
    })),
  });
}
