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
  await expect(
    page.locator(`[data-card-id="${cardId}"]`),
  ).toHaveCount(0, { timeout: 2000 });
  // A wrong answer now opens the correction overlay; type the right answer to
  // clear it so the caller's next answerCurrent finds a fresh card.
  if (value !== answer) {
    await expect(page.getByTestId('correction')).toBeVisible({ timeout: 1000 });
    await page.getByTestId('answer-input').fill(String(answer));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeHidden({ timeout: 1000 });
  }
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

  test('wrong answer → red correction overlay; must enter correct answer to continue', async ({
    page,
  }) => {
    await bootAsUser(page, 'carol');
    // one correct first to get a combo going
    await answerCurrent(page, (a) => a);
    // now submit wrong on the current target
    const card = await nextTargetCard(page);
    const txt = (await card.innerText()).trim();
    const m = txt.match(/(\d+)\s*\u00d7\s*(\d+)/)!;
    const [a, b] = [+m[1], +m[2]];
    const correct = a * b;
    await page.getByTestId('answer-input').fill(String(correct + 13));
    await page.getByTestId('answer-input').press('Enter');
    // correction overlay should appear and the field should no longer show cards
    await expect(page.getByTestId('correction')).toBeVisible({ timeout: 1000 });
    await expect(page.locator('[data-testid^="card-"]')).toHaveCount(0);
    // combo resets immediately on the wrong answer
    const combo = await page.getByTestId('combo-counter').innerText();
    expect(combo).toMatch(/[×x]\s*0/);
    await page.screenshot({ path: `${SHOT_DIR}/03-miss-flash.png` });
    // another wrong answer during correction should stay in correction and bump attempts
    await page.getByTestId('answer-input').fill(String(correct + 1));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeVisible();
    await expect(page.getByTestId('correction-attempts')).toContainText('1 wrong');
    // typing the correct answer clears correction and play resumes
    await page.getByTestId('answer-input').fill(String(correct));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeHidden({ timeout: 1000 });
    await expect(page.locator('[data-testid^="card-"]').first()).toBeVisible({
      timeout: 1000,
    });
  });

  test('correction attempts are logged as events with is_correction=true', async ({
    page,
  }) => {
    await bootAsUser(page, 'jules');
    const card = await nextTargetCard(page);
    const m = (await card.innerText()).match(/(\d+)\s*\u00d7\s*(\d+)/)!;
    const correct = +m[1] * +m[2];
    // Initial wrong to open correction.
    await page.getByTestId('answer-input').fill(String(correct + 13));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeVisible();
    // One wrong try during correction.
    await page.getByTestId('answer-input').fill(String(correct + 1));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction-attempts')).toContainText('1 wrong');
    // Finally the correct one.
    await page.getByTestId('answer-input').fill(String(correct));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeHidden();

    const events = await page.evaluate(() => {
      const raw = localStorage.getItem('flashcards_browser_store_v1');
      return raw ? JSON.parse(raw).db.events : [];
    });
    expect(events.length).toBeGreaterThanOrEqual(3);
    // The original wrong answer is logged with is_correction unset/false.
    expect(events[0]).toMatchObject({ is_correct: false, is_correction: false });
    // Then one wrong correction attempt.
    expect(events[1]).toMatchObject({ is_correct: false, is_correction: true });
    // Then the correct correction attempt.
    expect(events[2]).toMatchObject({ is_correct: true, is_correction: true });
    // All three share the same question_uuid.
    const qu = events[0].question_uuid;
    expect(events[1].question_uuid).toBe(qu);
    expect(events[2].question_uuid).toBe(qu);
  });

  test('timeout (card falls off) triggers correction mode', async ({ page }) => {
    // Use ?fast=500 so a timeout fires within a second or so.
    await page.addInitScript(() => {
      const seed = {
        db: { open: true, path: '/fake/family.flashcards_sqlite', users: [], events: [] },
        prefs: { db_path: '/fake/family.flashcards_sqlite', last_username: null },
      };
      localStorage.setItem('flashcards_browser_store_v1', JSON.stringify(seed));
    });
    await page.goto('/?fast=500');
    await page.getByTestId('user-new-name').fill('iris');
    await page.getByTestId('user-confirm').click();
    await expect(page.getByTestId('active-user')).toContainText('iris');
    const card = await nextTargetCard(page);
    const txt = (await card.innerText()).trim();
    const m = txt.match(/(\d+)\s*\u00d7\s*(\d+)/)!;
    const correct = +m[1] * +m[2];
    // Do not answer; wait for timeout.
    await expect(page.getByTestId('correction')).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId('correction')).toContainText('MISS');
    // Typing the correct answer clears it.
    await page.getByTestId('answer-input').fill(String(correct));
    await page.getByTestId('answer-input').press('Enter');
    await expect(page.getByTestId('correction')).toBeHidden({ timeout: 1000 });
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
