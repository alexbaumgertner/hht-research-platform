import { getPayload } from 'payload';
import config from '@payload-config';

import { sendCodeEmail } from './codeEmail';
import type { OtpDeps } from './otp';
import { payloadOtpStore } from './payloadStore';
import { sessionSecret } from './session';

export async function otpDeps(): Promise<OtpDeps> {
  const payload = await getPayload({ config });
  return { store: payloadOtpStore(payload), sendCode: sendCodeEmail, secret: sessionSecret() };
}

/** Vercel sets x-forwarded-for; its first entry is the client. */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
