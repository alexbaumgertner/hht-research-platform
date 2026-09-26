import { normalizeSubscriberEmail } from './subscriberEmail';

describe('normalizeSubscriberEmail', () => {
  it('matches an address that differs only by case and surrounding space', () => {
    expect(normalizeSubscriberEmail('  User@Example.com ')).toBe('user@example.com');
    expect(normalizeSubscriberEmail('User@Example.com')).toBe(
      normalizeSubscriberEmail('user@example.com'),
    );
  });

  it('keeps plus-tags as a distinct address', () => {
    expect(normalizeSubscriberEmail('user+hht@gmail.com')).toBe('user+hht@gmail.com');
    expect(normalizeSubscriberEmail('user+hht@gmail.com')).not.toBe(
      normalizeSubscriberEmail('user@gmail.com'),
    );
  });
});
