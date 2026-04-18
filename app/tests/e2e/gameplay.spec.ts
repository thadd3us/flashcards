import { test, expect, type Page } from '@playwright/test';

const SHOT_DIR = 'screenshots';
// ?fast=400 → 400 ms spawn interval + 400 ms fall. Tests don't need the
// full 10 s calibration humans get.
const FAST_URL = '/?fast=400';

async function bootAsUser(page: Page, name: string) {
  await page.addInitScript(() => {
    const seed = {
      db: { open: true, path: '/fake/family.flashcards_sqlite', users: [], events: [] },
      prefs: { db_path: '/fake/family.flashcards_sqlite', last_username: null },
    };
    localStorage.setItem('flashcards_browser_store_v1', JSON.stringify(seed));
  });
  await page.goto(FAST_URL);
  await expect(page.getByTestId('user-new-name')).toBeVisible();
  await page.getByTestId('user-new-name').fill(name);
  await page.getByTestId('user-confirm').click();
  await expect(page.getByTestId('active-user')).toContainText(name);
}

// Wait for a fresh target card to appear — robust across the 1-card-at-a-time
// cadence where previous cards disappear before the next spawns.
async function nextTargetCard(page: Page) {
  const card = page.locator('.card.target').first();
  await card.waitFor({ state: 'visible', timeout: 5000 });
  return card;
}

async function answerCurrent(page: Page, submission: (answer: number) => number) {
  const card = await nextTargetCard(page);
  const cardId = await card.getAttribute('data-card-id');
  const txt = (await card.innerText()).trim();
  const m = txt.match(/(\d+)\s*\u00d7\s*(\d+)/);
  if (!m) throw new Error(`card text parse: ${txt}`);
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const answer = a * b;
  const value = submission(answer);
  await page.getByTestId('answer-input').fill(String(value));
  await page.getByTestId('answer-input').press('Enter');
  // Wait for this specific card instance to be gone (data-card-id is unique per spawn).
  await expect(
    page.locator(`[data-card-id="${cardId}"]`),
  ).toHaveCount(0, { timeout: 2000 });
  return { answer, submitted: value, a, b };
}

test.describe('Times Table Flashcards — gameplay', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('user selection and play tab renders with a falling card', async ({ page }) => {
    await bootAsUser(page, 'alice');
    await expect(page.getByTestId('answer-input')).toBeVisible();
    await expect(page.locator('[data-testid^="card-"]').first()).toBeVisible({
      timeout: 3000,
    });
    await page.screenshot({ path: `${SHOT_DIR}/01-play-initial.png`, fullPage: false });
  });

  test('correct answers → combo increments + tier flash', async ({ page }) => {
    await bootAsUser(page, 'bob');
    for (let i = 0; i < 4; i++) {
      await answerCurrent(page, (a) => a);
    }
    const combo = await page.getByTestId('combo-counter').innerText();
    expect(combo).toMatch(/[×x]\s*[1-9]/);
    // Wait for a fresh card to screenshot against.
    await nextTargetCard(page);
    await page.screenshot({ path: `${SHOT_DIR}/02-after-correct.png` });
  });

  test('wrong answer → miss flash + combo resets', async ({ page }) => {
    await bootAsUser(page, 'carol');
    await answerCurrent(page, (a) => a); // one correct first
    await answerCurrent(page, () => 9999); // then a wrong one
    await page.waitForTimeout(150);
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
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(0);
    await page.getByTestId('pause-btn').click();
    await expect(page.getByTestId('paused')).toBeHidden();
    await page.locator('[data-testid^="card-"]').first().waitFor();
  });

  test('Escape key toggles pause (not panic)', async ({ page }) => {
    await bootAsUser(page, 'gus');
    await page.locator('[data-testid^="card-"]').first().waitFor();
    // Focus the play area so keydown reaches the handler.
    await page.locator('.play').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('paused')).toBeVisible();
    // Panic button should NOT be armed — Escape must not have triggered it.
    await expect(page.getByTestId('panic-btn')).toHaveText(/Panic$/);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('paused')).toBeHidden();
  });

  test('next card appears immediately after an answer (no spawn gate)', async ({
    page,
  }) => {
    await bootAsUser(page, 'holly');
    const first = await nextTargetCard(page);
    const firstId = await first.getAttribute('data-card-id');
    await answerCurrent(page, (a) => a);
    // A fresh card with a different data-card-id should already be visible.
    const next = page.locator('.card.target').first();
    await expect(next).toBeVisible({ timeout: 500 });
    const nextId = await next.getAttribute('data-card-id');
    expect(nextId).not.toEqual(firstId);
  });

  test('stats tab shows grid and CDF after some answers', async ({ page }) => {
    await bootAsUser(page, 'elena');
    for (let i = 0; i < 8; i++) {
      await answerCurrent(page, (a) => (i % 3 === 0 ? a + 1 : a));
    }
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('times-grid')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/05-stats-tab.png`, fullPage: true });
  });

  test('calibration: one lane, displays 10s fall / 10s spawn at normal speed', async ({
    page,
  }) => {
    // Note: this test does NOT append ?fast= — we want the real calibration text.
    await page.addInitScript(() => {
      const seed = {
        db: { open: true, path: '/fake/family.flashcards_sqlite', users: [], events: [] },
        prefs: { db_path: '/fake/family.flashcards_sqlite', last_username: null },
      };
      localStorage.setItem('flashcards_browser_store_v1', JSON.stringify(seed));
    });
    await page.goto('/');
    await page.getByTestId('user-new-name').fill('frank');
    await page.getByTestId('user-confirm').click();
    await expect(page.getByTestId('active-user')).toContainText('frank');
    const diag = page.locator('.diag');
    await expect(diag).toContainText('Lanes 1');
    await expect(diag).toContainText('Fall 10s');
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(1);
    await page.screenshot({ path: `${SHOT_DIR}/06-calibration.png` });
  });
});
