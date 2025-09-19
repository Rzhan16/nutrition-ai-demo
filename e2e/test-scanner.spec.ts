import { test, expect } from '@playwright/test';

test.describe('Test Scanner page', () => {
  test('renders debug drawer toggle', async ({ page }) => {
    await page.goto('/test-scanner');
    await expect(page.getByRole('button', { name: /debug/i })).toBeVisible();
  });

  test.skip('handles blurry barcode fallback via manual correction', async ({ page }) => {
    await page.goto('/test-scanner');
    // TODO: simulate upload with low-confidence OCR once fixtures are available.
    await expect(page.getByText('Manual Correction')).toBeVisible();
  });

  test.skip('guides user when camera permission is denied', async ({ page }) => {
    await page.goto('/test-scanner');
    // TODO: mock navigator.mediaDevices.getUserMedia to reject and assert toast copy.
  });
});
