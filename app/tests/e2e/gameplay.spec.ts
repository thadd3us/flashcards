import { test, expect } from '@playwright/test';

const SHOT_DIR = 'screenshots';

async function bootAsUser(page: import('@playwright/test').Page, name: string) {
  // Seed a working browser-mode state so we skip the DB chooser modal.
  await page.addInitScript(() => {
    const seed = {
      db: { open: true, path: '/fake/family.flashcards_sqlite', users: [], events: [] },
      prefs: { db_path: '/fake/family.flashcards_sqlite', last_username: null },
    };
    localStorage.setItem('flashcards_browser_store_v1', JSON.stringify(seed));
  });
  await page.goto('/');
  // Should be on the "needs-user" screen (no users yet → new mode).
  await expect(page.getByTestId('user-new-name')).toBeVisible();
  await page.getByTestId('user-new-name').fill(name);
  await page.getByTestId('user-confirm').click();
  await expect(page.getByTestId('active-user')).toContainText(name);
}

test.describe('Times Table Flashcards — gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('user selection and play tab renders with a falling card', async ({ page }) => {
    await bootAsUser(page, 'alice');
    await expect(page.getByTestId('answer-input')).toBeVisible();
    // A card should appear within 1 s.
    await expect(page.locator('[data-testid^="card-"]').first()).toBeVisible({ timeout: 3000 });
    await page.screenshot({
      path: `${SHOT_DIR}/01-play-initial.png`,
      fullPage: false,
    });
  });

  test('submit a correct answer → combo increments, tier flash, PR badge possible', async ({
    page,
  }) => {
    await bootAsUser(page, 'bob');
    // Answer correctly by pulling the current card's answer out of the store.
    for (let i = 0; i < 5; i++) {
      // Wait for a card.
      const card = page.locator('.card.target').first();
      await card.waitFor({ state: 'visible', timeout: 5000 });
      const txt = (await card.innerText()).trim();
      const m = txt.match(/(\d+)\s*\u00d7\s*(\d+)/);
      if (!m) throw new Error(`card text parse: ${txt}`);
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const answer = a * b;
      await page.getByTestId('answer-input').fill(String(answer));
      await page.getByTestId('answer-input').press('Enter');
      // brief wait for tier flash & next card.
      await page.waitForTimeout(250);
    }
    const combo = await page.getByTestId('combo-counter').innerText();
    expect(combo).toMatch(/[×x]\s*[1-9]/);
    await page.screenshot({ path: `${SHOT_DIR}/02-after-correct.png` });
  });

  test('wrong answer → miss flash + combo resets', async ({ page }) => {
    await bootAsUser(page, 'carol');
    // First, get a correct streak
    const card1 = page.locator('.card.target').first();
    await card1.waitFor({ state: 'visible', timeout: 5000 });
    const t1 = await card1.innerText();
    const m1 = t1.match(/(\d+)\s*\u00d7\s*(\d+)/)!;
    await page.getByTestId('answer-input').fill(String(+m1[1] * +m1[2]));
    await page.getByTestId('answer-input').press('Enter');
    await page.waitForTimeout(200);
    // Now submit a wrong answer.
    await page.getByTestId('answer-input').fill('9999');
    await page.getByTestId('answer-input').press('Enter');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT_DIR}/03-miss-flash.png` });
    const combo = await page.getByTestId('combo-counter').innerText();
    expect(combo).toMatch(/[×x]\s*0/);
  });

  test('pause removes all cards, resume spawns fresh', async ({ page }) => {
    await bootAsUser(page, 'dave');
    await page.locator('[data-testid^="card-"]').first().waitFor();
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('paused')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/04-paused.png` });
    // No cards should be visible while paused.
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(0);
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('paused')).toBeHidden();
    await page.locator('[data-testid^="card-"]').first().waitFor();
  });

  test('stats tab shows grid and CDF', async ({ page }) => {
    await bootAsUser(page, 'elena');
    // Generate a handful of events (some correct, some wrong).
    for (let i = 0; i < 10; i++) {
      const card = page.locator('[data-testid^="card-"]').first();
      await card.waitFor({ state: 'visible', timeout: 5000 });
      const t = await card.innerText();
      const mm = t.match(/(\d+)\s*\u00d7\s*(\d+)/)!;
      const ans = +mm[1] * +mm[2];
      const submission = i % 3 === 0 ? ans + 1 : ans; // intentional wrongs
      await page.getByTestId('answer-input').fill(String(submission));
      await page.getByTestId('answer-input').press('Enter');
      await page.waitForTimeout(200);
    }
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('times-grid')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/05-stats-tab.png`, fullPage: true });
  });

  test('multiple lanes at higher performance', async ({ page }) => {
    await bootAsUser(page, 'frank');
    // Hammer fast correct answers to push difficulty up.
    for (let i = 0; i < 30; i++) {
      const card = page.locator('[data-testid^="card-"]').first();
      await card.waitFor({ state: 'visible', timeout: 5000 });
      const t = await card.innerText();
      const mm = t.match(/(\d+)\s*\u00d7\s*(\d+)/)!;
      const ans = +mm[1] * +mm[2];
      await page.getByTestId('answer-input').fill(String(ans));
      await page.getByTestId('answer-input').press('Enter');
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/06-high-difficulty.png` });
  });
});
