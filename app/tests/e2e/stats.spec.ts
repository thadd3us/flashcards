import { test, expect, type Page } from '@playwright/test';

const SHOT_DIR = 'screenshots';
const NS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Seed browser-mode storage with synthetic answer history spanning ~2 weeks,
// so the CDF "Now vs Then" comparison has data for both periods and the FSRS
// selector has something to work with.
async function seedHistoryAndBoot(page: Page, username: string) {
  await page.addInitScript(
    ({ username, NS }) => {
      // Minimal UUID v5 for "a*b" names — we don't need cryptographic fidelity
      // inside the seed, just a stable id. Call into a tiny JS impl inline.
      function uuidV5(name: string, namespace: string): string {
        // Convert namespace to bytes
        const nsBytes = new Uint8Array(16);
        const hex = namespace.replace(/-/g, '');
        for (let i = 0; i < 16; i++) {
          nsBytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        const nameBytes = new TextEncoder().encode(name);
        const buf = new Uint8Array(nsBytes.length + nameBytes.length);
        buf.set(nsBytes, 0);
        buf.set(nameBytes, nsBytes.length);

        // SHA-1 implemented inline
        function sha1(bytes: Uint8Array): Uint8Array {
          const padded: number[] = Array.from(bytes);
          const origLen = bytes.length;
          padded.push(0x80);
          while (padded.length % 64 !== 56) padded.push(0);
          const bitLen = BigInt(origLen) * 8n;
          for (let i = 7; i >= 0; i--) {
            padded.push(Number((bitLen >> BigInt(i * 8)) & 0xffn));
          }
          let h0 = 0x67452301,
            h1 = 0xefcdab89,
            h2 = 0x98badcfe,
            h3 = 0x10325476,
            h4 = 0xc3d2e1f0;
          const rotl = (v: number, n: number) =>
            ((v << n) | (v >>> (32 - n))) >>> 0;
          for (let i = 0; i < padded.length; i += 64) {
            const w: number[] = [];
            for (let j = 0; j < 16; j++) {
              w.push(
                (padded[i + j * 4] << 24) |
                  (padded[i + j * 4 + 1] << 16) |
                  (padded[i + j * 4 + 2] << 8) |
                  padded[i + j * 4 + 3],
              );
            }
            for (let j = 16; j < 80; j++) {
              w.push(rotl(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1));
            }
            let a = h0,
              b = h1,
              c = h2,
              d = h3,
              e = h4;
            for (let j = 0; j < 80; j++) {
              let f: number, k: number;
              if (j < 20) {
                f = (b & c) | (~b & d);
                k = 0x5a827999;
              } else if (j < 40) {
                f = b ^ c ^ d;
                k = 0x6ed9eba1;
              } else if (j < 60) {
                f = (b & c) | (b & d) | (c & d);
                k = 0x8f1bbcdc;
              } else {
                f = b ^ c ^ d;
                k = 0xca62c1d6;
              }
              const temp = (rotl(a, 5) + f + e + k + w[j]) >>> 0;
              e = d;
              d = c;
              c = rotl(b, 30);
              b = a;
              a = temp;
            }
            h0 = (h0 + a) >>> 0;
            h1 = (h1 + b) >>> 0;
            h2 = (h2 + c) >>> 0;
            h3 = (h3 + d) >>> 0;
            h4 = (h4 + e) >>> 0;
          }
          const out = new Uint8Array(20);
          const push = (v: number, off: number) => {
            out[off] = (v >> 24) & 0xff;
            out[off + 1] = (v >> 16) & 0xff;
            out[off + 2] = (v >> 8) & 0xff;
            out[off + 3] = v & 0xff;
          };
          push(h0, 0);
          push(h1, 4);
          push(h2, 8);
          push(h3, 12);
          push(h4, 16);
          return out;
        }
        const hash = sha1(buf).slice(0, 16);
        hash[6] = (hash[6] & 0x0f) | 0x50;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hx = Array.from(hash)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        return `${hx.slice(0, 8)}-${hx.slice(8, 12)}-${hx.slice(12, 16)}-${hx.slice(16, 20)}-${hx.slice(20)}`;
      }

      function canonicalName(a: number, b: number) {
        return a <= b ? `${a}*${b}` : `${b}*${a}`;
      }

      // Deterministic pseudo-random
      let seed = 42;
      function rand() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 0x100000000;
      }

      const now = Date.now();
      const events: unknown[] = [];

      // Build two cohorts of events:
      // - "Then": centered 8 days ago, slower + more wrongs.
      // - "Now": centered in the last 24 h, faster + fewer wrongs.
      function push(age_ms: number, a: number, b: number, mean_ms: number, p_wrong: number) {
        const ts = new Date(now - age_ms);
        const tz = -ts.getTimezoneOffset();
        const sign = tz >= 0 ? '+' : '-';
        const pad = (n: number) => String(n).padStart(2, '0');
        const tsStr =
          ts.getFullYear() +
          '-' + pad(ts.getMonth() + 1) +
          '-' + pad(ts.getDate()) +
          'T' + pad(ts.getHours()) +
          ':' + pad(ts.getMinutes()) +
          ':' + pad(ts.getSeconds()) +
          sign + pad(Math.floor(Math.abs(tz) / 60)) +
          ':' + pad(Math.abs(tz) % 60);
        const is_correct = rand() > p_wrong;
        const rt = Math.max(400, Math.round(mean_ms + (rand() - 0.5) * 2 * mean_ms * 0.4));
        const qu = uuidV5(canonicalName(a, b), NS);
        events.push({
          uuid: uuidV5(`${tsStr}-${a}-${b}-${rand()}`, NS),
          question_uuid: qu,
          question: {
            uuid: qu,
            content: `${a} \u00d7 ${b}`,
            operandA: a,
            operandB: b,
            answer: a * b,
          },
          username,
          timestamp: tsStr,
          response_time_ms: rt,
          is_correct,
          is_timeout: false,
          answer_submitted: is_correct ? a * b : a * b + 1,
          app_version: '0.1.0',
        });
      }

      // "Then" window (~6-10 days ago): slower (avg 3200 ms), ~35% wrong
      for (let i = 0; i < 60; i++) {
        const a = Math.floor(rand() * 13);
        const b = Math.floor(rand() * 13);
        const age = (6 + rand() * 4) * 24 * 3600_000;
        push(age, a, b, 3200, 0.35);
      }
      // "Now" window (last 20 h): faster (avg 1600 ms), ~12% wrong
      for (let i = 0; i < 60; i++) {
        const a = Math.floor(rand() * 13);
        const b = Math.floor(rand() * 13);
        const age = rand() * 20 * 3600_000;
        push(age, a, b, 1600, 0.12);
      }

      const seedStore = {
        db: {
          open: true,
          path: '/fake/family.flashcards_sqlite',
          users: [
            {
              username,
              created_at: new Date(now - 15 * 24 * 3600_000).toISOString(),
              app_version: '0.1.0',
            },
          ],
          events,
        },
        prefs: {
          db_path: '/fake/family.flashcards_sqlite',
          last_username: username,
        },
      };
      localStorage.setItem('flashcards_browser_store_v1', JSON.stringify(seedStore));
    },
    { username, NS },
  );
  await page.goto('/?fast=400');
  // User picker with existing user preselected.
  await expect(page.getByTestId('user-picker')).toBeVisible();
  await page.getByTestId('user-confirm').click();
  await expect(page.getByTestId('active-user')).toContainText(username);
}

test.describe('Stats tab — CDF compare + FSRS seeding', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
  });

  test('single-mode CDF with seeded history', async ({ page }) => {
    await seedHistoryAndBoot(page, 'seed-alice');
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('times-grid')).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/10-cdf-single-seeded.png`, fullPage: true });
  });

  test('compare-mode CDF: Now vs Then with wrongs on right tail', async ({ page }) => {
    await seedHistoryAndBoot(page, 'seed-bob');
    await page.getByTestId('tab-stats').click();
    await page.getByTestId('cdf-mode-compare').click();
    await expect(page.getByTestId('cmp-day')).toBeVisible();
    // Default is "day" — switch to "week" to include the Then cohort centered 8d ago.
    await page.getByTestId('cmp-week').click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOT_DIR}/11-cdf-compare-week.png`, fullPage: true });
    // And a "month" view that still shows the difference
    await page.getByTestId('cmp-month').click();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOT_DIR}/12-cdf-compare-month.png`, fullPage: true });
  });
});
