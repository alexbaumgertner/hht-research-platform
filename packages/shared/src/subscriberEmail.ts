/** Trim and lowercase. Plus-tags stay, so `user+hht@gmail.com` is its own address. */
export function normalizeSubscriberEmail(value: string): string {
  return value.trim().toLowerCase();
}
