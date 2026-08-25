import { test, expect } from '@playwright/test';

test.describe('monitoring digest visibility', () => {
  test('public digests API responds for seeded project', async ({ request }) => {
    const projects = await request.get('/api/public/projects');
    expect(projects.ok()).toBeTruthy();
    const body = await projects.json();
    if (!body.docs?.length) {
      test.skip(true, 'Requires seeded digest');
      return;
    }
    const slug = body.docs[0].slug as string;
    const digests = await request.get(`/api/public/projects/${slug}/digests`);
    expect(digests.ok()).toBeTruthy();
    const digestBody = await digests.json();
    expect(Array.isArray(digestBody.docs)).toBeTruthy();
  });
});
