import { test, expect } from '@playwright/test';

test.describe('monitoring digest visibility', () => {
  test('public materials API responds for seeded project', async ({ request }) => {
    const projects = await request.get('/api/public/projects');
    expect(projects.ok()).toBeTruthy();
    const body = await projects.json();
    if (!body.docs?.length) {
      test.skip(true, 'Requires seeded digest');
      return;
    }
    const slug = body.docs[0].slug as string;
    const materials = await request.get(`/api/public/projects/${slug}/materials`);
    expect(materials.ok()).toBeTruthy();
    const materialsBody = await materials.json();
    expect(Array.isArray(materialsBody.docs)).toBeTruthy();
  });
});
