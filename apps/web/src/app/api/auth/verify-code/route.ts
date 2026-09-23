import { NextResponse } from 'next/server';

import { otpDeps } from '@/lib/auth/deps';
import { verifyCode } from '@/lib/auth/otp';
import {
  issueToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionSecret,
} from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sessionSecret()) {
    return NextResponse.json({ error: 'Login is not configured.' }, { status: 503 });
  }
  let email = '';
  let code = '';
  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown };
    email = String(body.email ?? '');
    code = String(body.code ?? '');
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const result = await verifyCode(email, code, await otpDeps());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });

  const { token, maxAge } = issueToken(result.userId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
