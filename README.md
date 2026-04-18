# Times Table Flashcards

A Tauri (Rust) + Vue 3 desktop app for drilling multiplication facts 0×0 through
12×12 in a dark sci-fi aesthetic. DDR-style falling cards, persistent rolling
proficiency sparkline, and a stats tab with a times-table heatmap and response-time
CDF (with an optional "Now vs Then" comparison mode).

See [spec/times-table-flashcards/spec.md](spec/times-table-flashcards/spec.md) for
the design notes and [app/](app/) for the implementation.

## Prerequisites

- **Node** ≥ 18 (tested on 24), **npm**
- **Rust** (stable) with `cargo` — only needed for the native Tauri build
- macOS / Windows / Linux (Tauri 2 supports all three)

## Setup

All commands work from the **repo root**. The root [package.json](package.json)
proxies to `app/` via `npm --prefix app ...`.

First-time install:

```sh
npm run install-app          # = npm install --prefix app
npm run test:install         # downloads the Chromium build Playwright uses
```

Rust deps are fetched automatically by `cargo` on first `tauri:dev` / `tauri:build`.

## Run

### Web dev server (fast, no native build)

Vite hot-reload at http://localhost:5173. The app auto-detects it isn't inside
Tauri and falls back to `localStorage` for the DB and prefs, so you can iterate
on UI without compiling Rust.

```sh
npm run dev                   # from repo root
```

`?fast=<ms>` query-string override accelerates the spawn interval + fall
duration for manual tuning (useful when the 10 s default is too slow for
fiddling):

```
http://localhost:5173/?fast=800
```

### Native Tauri app

Full desktop app with SQLite persistence in WAL mode, platform file picker, and
the `tauri-plugin-store` preferences file. First run compiles the Rust bundle
(~1 min on a warm cache, longer cold):

```sh
npm run tauri:dev             # dev mode with HMR
npm run tauri:build           # release bundle → app/src-tauri/target/release/bundle/
```

### Tests

Playwright E2E suite runs against the Vite dev server in browser-only mode and
captures screenshots into [app/screenshots/](app/screenshots/).

```sh
npm test                      # full suite (8 tests)
npm test -- --headed          # watch it run
npm test -- tests/e2e/gameplay.spec.ts
```

The Playwright config auto-starts Vite and reuses an existing dev server if one
is already running.

## Targeting a different app directory

The root scripts hard-code `--prefix app`, but npm's `--prefix` flag accepts any
path. To run against a different checkout or fork, skip the proxy and call npm
directly:

```sh
npm --prefix /path/to/other-app run dev
npm --prefix ../fork test
```

## Project layout

```
flashcards/
├── package.json                # root proxy scripts (dev / build / test / tauri:*)
├── app/                        # Tauri + Vue 3 app
│   ├── src/                    # Vue frontend (types, stores, composables, components)
│   ├── src-tauri/              # Rust backend (rusqlite DB, commands, plugins)
│   ├── tests/e2e/              # Playwright specs (gameplay + stats)
│   ├── screenshots/            # Captured during test runs
│   └── playwright.config.ts
└── spec/times-table-flashcards/
    └── spec.md                 # Full design spec
```

## Calibration knobs

The gameplay defaults (in [app/src/stores/gameStore.ts](app/src/stores/gameStore.ts))
are currently locked to 1 lane, 10 s fall, 10 s spawn interval for tuning. The
adaptive difficulty ramp lives in `estimateDifficulty`
([app/src/utils/selector.ts](app/src/utils/selector.ts)) — history-insensitive
for now; re-enable by replacing the stubbed return value with a history-based
heuristic.

RL-side params are in `DEFAULT_PARAMS` in
[app/src/utils/selector.ts](app/src/utils/selector.ts):

- `findHolesVsReinforce` (0..1): 0 = all discovery, 1 = all fill
- `softmaxTemperature`: exploration temperature on the per-card scores
- `unseenPriorWeight`: pseudo-count for the fixed prior when blending with
  observed first-attempt discovery rewards

Each `AnswerEvent` persists a `selection_provenance` field with the picker path,
score, baseline, and top-K contenders at selection time — useful for debugging
the selector's choices and for later online parameter fitting.
