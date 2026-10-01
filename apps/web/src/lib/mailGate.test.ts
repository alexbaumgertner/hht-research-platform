import { subscriberMailEnabled } from './mailGate';

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
