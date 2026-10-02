import { fromAddress, isSandboxFromAddress, subscriberMailEnabled } from './mailGate';
import { emailSender, subscriberSender } from './email';

const live = {
  RESEND_API_KEY: 're_key',
  RESEND_FROM_EMAIL: 'HHT Digest <news@hht.rarediseasedigest.org>',
};

describe('subscriberMailEnabled', () => {
  it('is open on production with a verified sender', () => {
    expect(subscriberMailEnabled({ ...live, VERCEL_ENV: 'production' })).toBe(true);
  });

  it('is open locally and in CI, where VERCEL_ENV is unset', () => {
    expect(subscriberMailEnabled(live)).toBe(true);
  });

  it('is closed on Vercel Preview even with the production key and sender', () => {
    expect(subscriberMailEnabled({ ...live, VERCEL_ENV: 'preview' })).toBe(false);
  });

  it('is closed for the resend.dev sandbox sender or a missing key', () => {
    expect(subscriberMailEnabled({ ...live, RESEND_FROM_EMAIL: 'onboarding@resend.dev' })).toBe(
      false,
    );
    expect(subscriberMailEnabled({ ...live, RESEND_API_KEY: ' ' })).toBe(false);
  });
});

describe('RESEND_FROM_EMAIL formats', () => {
  const named = { RESEND_FROM_EMAIL: 'HHT Digest <news@hht.rarediseasedigest.org>' };
  const bare = { RESEND_FROM_EMAIL: ' news@hht.rarediseasedigest.org ' };

  it('fromAddress returns the bare address for `Name <a@b>` and `a@b`', () => {
    expect(fromAddress(named)).toBe('news@hht.rarediseasedigest.org');
    expect(fromAddress(bare)).toBe('news@hht.rarediseasedigest.org');
    expect(fromAddress({})).toBe('');
  });

  it('emailSender never nests angle brackets', () => {
    expect(emailSender(named)).toBe('HHT News <news@hht.rarediseasedigest.org>');
    expect(emailSender(bare)).toBe('HHT News <news@hht.rarediseasedigest.org>');
    expect(emailSender({})).toBe('HHT News <onboarding@resend.dev>');
  });

  it('subscriberSender never nests angle brackets', () => {
    expect(subscriberSender('HHT Digest', named)).toBe(
      'HHT Digest <news@hht.rarediseasedigest.org>',
    );
  });

  it('AUTH_EMAIL_FROM still wins over RESEND_FROM_EMAIL', () => {
    expect(emailSender({ ...named, AUTH_EMAIL_FROM: 'Auth <auth@example.org>' })).toBe(
      'Auth <auth@example.org>',
    );
  });

  it('detects the sandbox sender in the `Name <a@resend.dev>` form too', () => {
    expect(isSandboxFromAddress({ RESEND_FROM_EMAIL: 'HHT <onboarding@resend.dev>' })).toBe(true);
    expect(isSandboxFromAddress(named)).toBe(false);
    expect(
      subscriberMailEnabled({ RESEND_API_KEY: 're_key', RESEND_FROM_EMAIL: 'HHT <a@resend.dev>' }),
    ).toBe(false);
  });
});
