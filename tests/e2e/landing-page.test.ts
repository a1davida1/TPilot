import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display live metrics and replace placeholder fallbacks', async ({ page }) => {
    // Navigate to the landing page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the page has loaded properly
    await expect(page.locator('h1')).toContainText('Turn every drop into a revenue engine');
    
    // Check that fallback/placeholder metrics are NOT displayed
    const fallbackElement = page.locator('[data-testid="hero-metric-fallback"]');
    await expect(fallbackElement).not.toBeVisible();
    
    // Check that live metrics ARE displayed with actual numbers
    const creatorsMetric = page.locator('[data-testid="hero-metric-creators"]');
    const postsMetric = page.locator('[data-testid="hero-metric-posts"]');
    const activeMetric = page.locator('[data-testid="hero-metric-active"]');
    
    // Verify metrics are visible
    await expect(creatorsMetric).toBeVisible();
    await expect(postsMetric).toBeVisible(); 
    await expect(activeMetric).toBeVisible();
    
    // Verify metrics contain numeric values (not just placeholders or dashes)
    const creatorsText = await creatorsMetric.textContent();
    const postsText = await postsMetric.textContent();
    const activeText = await activeMetric.textContent();
    
    // Check that metrics are numbers (formatted by Intl.NumberFormat)
    expect(creatorsText).toMatch(/^\d{1,3}(,\d{3})*$/); // Number format like "1,234" or "5"
    expect(postsText).toMatch(/^\d{1,3}(,\d{3})*$/);
    expect(activeText).toMatch(/^\d{1,3}(,\d{3})*$/);
    
    // Verify that no "--" placeholder text appears
    expect(creatorsText).not.toBe('--');
    expect(postsText).not.toBe('--');
    expect(activeText).not.toBe('--');
  });

  test('should handle metrics loading error gracefully', async ({ page }) => {
    // Intercept the analytics API and make it fail
    await page.route('/api/analytics/summary', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Server error' })
      });
    });
    
    // Navigate to the landing page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that error state is displayed instead of metrics
    const errorCard = page.locator('.border-destructive\\/40');
    await expect(errorCard).toBeVisible();
    await expect(errorCard).toContainText('Unable to load metrics');
  });

  test('should display loading state initially', async ({ page }) => {
    // Intercept the analytics API to delay the response
    await page.route('/api/analytics/summary', async route => {
      // Delay the response by 2 seconds to test loading state
      await new Promise(resolve => setTimeout(resolve, 2000));
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          creators: 42,
          posts: 1337,
          activeSubscriptions: 23,
          engagement: 85,
          generatedAt: new Date().toISOString()
        })
      });
    });
    
    // Navigate to the landing page
    await page.goto('/');
    
    // Check that loading fallback is initially displayed
    const fallbackElement = page.locator('[data-testid="hero-metric-fallback"]');
    await expect(fallbackElement).toBeVisible();
    
    // Check that skeleton loading animations are present
    const skeletons = page.locator('.animate-pulse');
    await expect(skeletons.first()).toBeVisible();
    
    // Wait for metrics to load and verify fallback is replaced
    await expect(fallbackElement).not.toBeVisible({ timeout: 5000 });
    
    // Verify real metrics are now displayed
    const creatorsMetric = page.locator('[data-testid="hero-metric-creators"]');
    await expect(creatorsMetric).toBeVisible();
    await expect(creatorsMetric).toContainText('42');
  });

  test('should display feature highlights and testimonials', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check feature section is present
    await expect(page.locator('h2#features-heading')).toContainText('Ship smart content');
    
    // Check that all 3 feature cards are displayed
    const featureCards = page.locator('section[aria-labelledby="features-heading"] .card');
    await expect(featureCards).toHaveCount(3);
    
    // Check feature titles
    await expect(page.locator('text=AI Caption Studio')).toBeVisible();
    await expect(page.locator('text=Protection Guardrails')).toBeVisible();
    await expect(page.locator('text=Revenue Intelligence')).toBeVisible();
    
    // Check testimonials section
    await expect(page.locator('h2#testimonials-heading')).toContainText('Teams trust ThottoPilot');
    
    // Check that all 3 testimonial cards are displayed
    const testimonialCards = page.locator('section[aria-labelledby="testimonials-heading"] .card');
    await expect(testimonialCards).toHaveCount(3);
  });

  test('should have proper accessibility attributes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check ARIA labels and roles
    await expect(page.locator('[role="list"]')).toBeVisible(); // Metrics grid
    await expect(page.locator('[aria-live="polite"]')).toBeVisible(); // Fallback state
    
    // Check that icons have aria-hidden
    const hiddenIcons = page.locator('[aria-hidden="true"]');
    await expect(hiddenIcons.first()).toBeVisible();
    
    // Check section headings have proper IDs for accessibility
    await expect(page.locator('#features-heading')).toBeVisible();
    await expect(page.locator('#testimonials-heading')).toBeVisible();
  });
});