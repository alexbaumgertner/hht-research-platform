import { NextResponse } from 'next/server';

import { clientIp, otpDeps } from '@/lib/auth/deps';
import { MAIL_BROKEN, requestCode } from '@/lib/auth/otp';
import { sessionSecret } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sessionSecret()) {
    return NextResponse.json({ error: 'Login is not configured.' }, { status: 503 });
  }
  let email = '';
  try {
    email = String(((await request.json()) as { email?: unknown }).email ?? '');
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const result = await requestCode(email, clientIp(request), await otpDeps());
  if (!result.ok) {
    const status = result.error === MAIL_BROKEN ? 502 : 429;
    return NextResponse.json({ error: result.error }, { status });
  }
  // Same answer for admin and unknown addresses.
  return NextResponse.json({ ok: true });
}
