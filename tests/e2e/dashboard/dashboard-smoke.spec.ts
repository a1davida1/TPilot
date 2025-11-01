import { expect, test } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('Dashboard smoke checks', () => {
  test('gallery renders stats and media grid', async ({ page }) => {
    await page.route('**/api/gallery**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          pageSize: 20,
          totalItems: 2,
          totalPages: 1,
          hasMore: false,
          items: [
            {
              id: 1,
              filename: 'test-image.jpg',
              thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
              sourceUrl: 'https://cdn.example.com/src.jpg',
              bytes: 2_048_000,
              mime: 'image/jpeg',
              createdAt: new Date().toISOString(),
              isWatermarked: true,
              lastRepostedAt: null,
            },
            {
              id: 2,
              filename: 'cooldown-image.png',
              thumbnailUrl: 'https://cdn.example.com/thumb2.jpg',
              sourceUrl: 'https://cdn.example.com/src2.jpg',
              bytes: 1_024_000,
              mime: 'image/png',
              createdAt: new Date().toISOString(),
              isWatermarked: false,
              lastRepostedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE_URL}/gallery`);
    await expect(page.getByRole('heading', { name: 'Media control center' })).toBeVisible();
    await expect(page.getByText('ImageShield')).toBeVisible();
    await expect(page.getByRole('button', { name: /Load more/i })).toBeVisible();
  });

  test('posting workspace hydrates saved variants', async ({ page }) => {
    await page.route('**/api/ai/generate/variants**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          variants: [
            {
              id: 10,
              subreddit: 'redditgetsdrawn',
              persona: 'flirty_playful',
              tones: ['story'],
              finalCaption: 'Sample caption draft',
              finalAlt: null,
              finalCta: null,
              hashtags: ['#thottopilot'],
              rankedMetadata: null,
              imageUrl: 'https://cdn.example.com/sample.jpg',
              imageId: 42,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto(`${BASE_URL}/posting`);
    await expect(page.getByRole('heading', { name: /caption lab/i })).toBeVisible();
    await expect(page.getByText('Sample caption draft')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate captions/i })).toBeVisible();
  });

  test('schedule risk dashboard lists warnings', async ({ page }) => {
    await page.route('**/api/reddit/risk**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          cached: false,
          data: {
            generatedAt: new Date().toISOString(),
            warnings: [
              {
                id: 'warn-1',
                type: 'cadence',
                severity: 'high',
                subreddit: 'exampleSub',
                title: 'Cooldown conflict detected',
                message: 'You posted within the last 6 hours.',
                recommendedAction: 'Delay the next post to avoid removal.',
                metadata: {
                  cooldownHours: 12,
                  scheduledFor: new Date().toISOString(),
                },
              },
            ],
            stats: {
              upcomingCount: 1,
              flaggedSubreddits: 1,
              removalCount: 0,
              cooldownConflicts: 1,
            },
          },
          rateLimit: {
            limit: 60,
            remaining: 59,
            resetAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
        }),
      });
    });

    await page.goto(`${BASE_URL}/posting/schedule`);
    await expect(page.getByRole('heading', { name: /Risk overview/i })).toBeVisible();
    await expect(page.getByText(/Cooldown conflict detected/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Run risk check/i })).toBeVisible();
  });
});
