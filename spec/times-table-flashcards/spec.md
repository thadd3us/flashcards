# Times Table Flashcards — Implementation Spec

## Overview

A Tauri (Rust) + Vue 3 desktop app for drilling multiplication facts (0×0 through 12×12) in a dark sci-fi aesthetic inspired by DDR, The Matrix, and Tokyo Night. It is a family app with no server component: all data lives in a single `.flashcards_sqlite` file the family can store on Dropbox and open on any family computer.

**Core UX loop:**
1. Launch → enter/pick username → silent reopen of last database (or file picker) → RL model retrains in background from that user's history.
2. Navigate between two full-screen tabs via a top bar that also shows a live sparkline of the current proficiency score.
3. **Play tab:** DDR-style lanes scroll multiplication cards downward at RL-controlled speed. The player types an answer and presses Enter; the answer always targets the card closest to the bottom. Correct/incorrect/speed tier is flashed with a sound effect; combos are tracked and announced. Pause button removes all on-screen cards; resume spawns a fresh set.
4. **Stats tab:** a times table grid (heat-map colored by accuracy × speed) and a CDF chart of reaction times, both filterable by time window.
5. Session ends at app close; a session-summary overlay appears.

---

## Expected Behavior

### Startup & File Handling
- On first launch, prompt for a username (free text).
- Subsequent launches present a dropdown of known usernames plus "Add new."
- App reads the stored `.flashcards_sqlite` path from OS preferences (via `tauri-plugin-store` or platform config directory); if found, opens silently in WAL mode.
- If the path is missing or the file is gone, show a file-picker dialog (open `.flashcards_sqlite`) or a "Create new" option.
- The app registers itself as the handler for `.flashcards_sqlite` on all platforms; double-clicking a file in the OS opens the app and loads that file, storing the new path in preferences.
- If the file is locked by another writer, show a non-blocking banner: "File locked — retrying…" and retry with exponential back-off up to ~30 s before surfacing a dialog.

### Play Tab — DDR Mechanic
- Cards (e.g., "7 × 8 = ?") appear at the top of one or more vertical lanes and scroll downward.
- The RL agent controls: number of active lanes (1–N), scroll speed (px/s), and which card to spawn next.
- A single text input at the bottom accepts the player's answer; pressing Enter submits it to the **lowest card currently on screen**.
- If a card reaches the bottom edge before an answer is submitted, it counts as a **Miss** for that specific card; the card disappears and the next card is queued.
- **Speed tiers** (tunable thresholds; defaults shown):
  - **Instant** — correct, < 1 000 ms
  - **Fast** — correct, 1 000–3 000 ms
  - **Slow** — correct, 3 000–6 000 ms
  - **Miss** — wrong answer OR timed out (scroll reaches bottom)
- Each tier shows a distinct brief flash overlay and plays a distinct sound effect (Web Audio API, no external audio files required initially).
- Consecutive correct answers build a **combo counter** shown on screen; a wrong answer or Miss resets it to 0. Milestones (×5, ×10, ×20…) are announced with a mid-session banner.
- **Personal record** (fastest-ever correct time for a specific card) is flagged in real-time with a brief "PR!" indicator.
- **Panic button** (keyboard shortcut + visible button): immediately collapses active lanes to 1 until the RL agent upgrades difficulty again.
- **Pause / Resume button**: on pause, all on-screen cards are removed immediately (no answer possible); on resume, the RL agent spawns a fresh set from scratch.

### Stats Tab
- **Times table grid** (13×13, rows/cols 0–12): each cell colored by a 2D encoding — hue (red→green) = accuracy ratio, brightness/saturation = median response speed. Time-window selector: Last Session / Last Day / Last Week / Last Month.
- **CDF chart**: two overlaid cumulative distribution curves (correct answers vs. incorrect/Miss), x-axis in ms, filtered by the same time window. Implemented with a lightweight charting library (e.g., Plotly).  Hover over a point on the CDF reveals details about the attempt: problem identity, answer submitted, etc.
- **Session summary overlay** on app close (or via a "View Summary" button): today's proficiency score vs. yesterday's, best streak, slowest card of the session.

### Persistent Sparkline
- Displayed at the top of the window across both tabs.
- **Current value**: rolling proficiency score = 1 / geometric_mean(speeds), where incorrect answers inject a synthetic "very slow" time (e.g., 10 000 ms). The window is configurable (default: last 50 answers).
- **Sparkline shape**: the full time series of that rolling value, sampled per-answer throughout the current session.

---

## Data Model

### SQLite Tables

Two tables; rows are stored as JSON blobs. No rigid schema migrations; every record carries `app_version` for forward-compat filtering.

```
answer_events (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)
user_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)
```

WAL mode is set immediately on file open: `PRAGMA journal_mode=WAL;`

### TypeScript Types (`src/types/`)

**`question.ts`**
```
interface Question {
  uuid: string           // deterministic UUID-v5 derived from "a*b"
  content: string        // e.g. "7 × 8"
  operandA: number       // 0–12
  operandB: number       // 0–12
  answer: number
}
```
The full question catalog (169 entries) is computed once at build time and stored as a static lookup table.

**`answerEvent.ts`**
```
interface AnswerEvent {
  uuid: string            // UUID-v4, unique per event
  question_uuid: string   // from Question.uuid
  question: // Let's store a copy of the whole question object here.
  username: string
  timestamp: string       // ISO 8601 with local TZ offset, e.g. "2026-04-18T14:32:01-07:00"
  response_time_ms: number
  is_correct: boolean
  is_timeout: boolean
  app_version: string
}
```

**`userProfile.ts`**
```
interface UserProfile {
  username: string
  created_at: string      // ISO 8601
  app_version: string
}
```

### Question UUID Derivation
- Namespace: a fixed app UUID `"6ba7b810-9dad-11d1-80b4-00c04fd430c8"` (DNS namespace, repurposed).
- Name: `"{a}*{b}"` (canonical, lower operand first: `min(a,b) * max(a,b)`).
- Algorithm: UUID v5 (SHA-1). Stable across machines and app versions.

### Preferences (OS-level, not in SQLite)
Stored via `tauri-plugin-store` in the platform config directory:
```
{
  "db_path": "/path/to/family.flashcards_sqlite",
  "last_username": "alice"
}
```

---

## Implementation Plan

### Repository Structure (this is flexible, just a suggestion -- below looks a little complex)
```
flashcards/
├── src-tauri/
│   ├── Cargo.toml                  # deps: tauri, rusqlite, candle-core, candle-nn, uuid, serde, serde_json, chrono, tauri-plugin-store
│   ├── tauri.conf.json             # file association: .flashcards_sqlite; app icons
│   └── src/
│       ├── main.rs                 # Tauri builder, plugin registration, command registration
│       ├── prefs.rs                # read/write db_path + last_username via tauri-plugin-store
│       ├── db/
│       │   ├── mod.rs
│       │   ├── sqlite.rs           # open_db(), enable_wal(), check_lock(), insert_answer_event(), insert_user_profile(), query_events_for_user(), query_all_users()
│       │   └── types.rs            # Rust mirrors of AnswerEvent, UserProfile structs; serde derives
│       ├── rl/
│       │   ├── mod.rs
│       │   ├── features.rs         # featurize_sequence(): Vec<AnswerEvent> → Tensor; operand one-hot encoding + recency/speed features
│       │   ├── model.rs            # PolicyNet struct (candle-nn); 3-layer MLP; forward() → (card_logits[169], scroll_speed, num_lanes)
│       │   ├── reward.rs           # compute_reward(): performance term + intrinsic curiosity bonus; BONUS_WEIGHT constant left open
│       │   ├── trainer.rs          # RlSession: holds model + optimizer (AdamW); train_from_history(); update_online(); select_next_card()
│       │   └── defaults.rs         # cold_start_policy(): uniform random card, speed=1.0, lanes=1
│       └── commands/
│           ├── mod.rs
│           ├── db_commands.rs      # Tauri commands: open_or_create_db, log_answer_event, get_answer_history, get_users, create_user
│           └── rl_commands.rs      # Tauri commands: init_rl_session, select_next_card, submit_answer_and_update (returns next card + difficulty params)
├── src/
│   ├── main.ts                     # Vue app entry, Pinia store setup, Tauri event listeners
│   ├── App.vue                     # Root: top bar (sparkline + tab nav), <router-view> or v-if tabs
│   ├── types/
│   │   ├── question.ts             # Question interface + QUESTION_CATALOG constant (169 entries)
│   │   ├── answerEvent.ts          # AnswerEvent interface
│   │   └── userProfile.ts         # UserProfile interface
│   ├── utils/
│   │   ├── questions.ts            # buildQuestionCatalog(), getQuestionByUuid(), canonicalUuid()
│   │   └── scoring.ts              # computeProficiency(events, windowSize), geometricMean(), MISS_PENALTY_MS, SPEED_TIER thresholds
│   ├── composables/
│   │   ├── useAudio.ts             # Web Audio API; playTierSound(tier: SpeedTier); sounds synthesized programmatically
│   │   ├── useProficiency.ts       # reactive rolling proficiency + sparkline history array; updated after each answer
│   │   └── useRl.ts                # thin wrapper around rl_commands Tauri IPC; exposes selectNextCard(), submitAnswer()
│   ├── stores/
│   │   ├── sessionStore.ts         # Pinia: active username, session start time, combo counter, personal records map, panic mode flag, pause state
│   │   ├── gameStore.ts            # Pinia: active lanes array, card queue, scroll speed, lane count; spawnCard(), removeCard(), pauseGame(), resumeGame()
│   │   └── statsStore.ts           # Pinia: answer history cache, selected time window, computed grid cells, computed CDF data
│   └── components/
│       ├── UserSelector.vue        # Startup modal: dropdown of past users + "New user" text input; emits username-selected
│       ├── SparklineBar.vue        # SVG sparkline + current score display; top bar widget
│       ├── PlayTab.vue             # Orchestrates game loop: spawns cards, handles keyboard input, routes answers to lowest card
│       ├── GameLane.vue            # Single vertical lane; owns its scrolling card list; emits card-expired(questionUuid)
│       ├── ScrollingCard.vue       # Animated card (CSS transform translateY); shows question text; tier-flash overlay
│       ├── AnswerInput.vue         # Single bottom input box; captures keydown Enter; emits answer-submitted(value)
│       ├── TierFlash.vue           # Full-screen brief overlay: "INSTANT" / "FAST" / "SLOW" / "MISS" with color coding
│       ├── ComboDisplay.vue        # Current combo counter + milestone banner
│       ├── PanicButton.vue         # Keyboard shortcut (Escape or P) + visible button; dispatches panic action to gameStore
│       ├── PauseButton.vue         # Play/pause toggle; dispatches pause/resume to gameStore
│       ├── StatsTab.vue            # Hosts TimesTableGrid + CdfPlot + time-window selector
│       ├── TimesTableGrid.vue      # 13×13 SVG/canvas grid; cell color computed from statsStore; tooltip on hover
│       ├── CdfPlot.vue             # Two-line CDF chart (Chart.js); correct vs. incorrect; filtered by time window
│       └── SessionSummary.vue      # Overlay on session end: proficiency delta, best streak, slowest card, PR badges
├── tests/
│   ├── unit/
│   │   ├── scoring.test.ts         # computeProficiency edge cases: all misses, all instants, single answer, empty
│   │   ├── questions.test.ts       # canonicalUuid stability, catalog completeness (169 entries, no duplicates)
│   │   └── rl_reward.test.rs       # Rust unit tests: compute_reward correctness, curiosity bonus monotonicity
│   ├── integration/
│   │   ├── db_logging.test.ts      # Tauri test harness: every answer event written with all required fields; WAL mode confirmed; user profile round-trip
│   │   └── rl_convergence.test.rs  # Rust: train on synthetic history where card X always wrong → policy must select X more often after N updates
│   └── ui/
│       ├── game_loop.test.ts       # Vitest + @testing-library/vue: card spawns → answer routed to lowest card → combo increments; pause removes cards; resume spawns fresh
│       └── pause_resume.test.ts    # Pause hides all cards; resume resets card queue; no answer possible while paused
```

### Key Implementation Details by Subsystem

#### Database (`src-tauri/src/db/sqlite.rs`)
- `open_db(path) -> Connection`: opens or creates the file; runs `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;`
- `check_lock()`: attempt a write transaction; on `SQLITE_BUSY` return `Err(DbError::Locked)`
- `insert_answer_event(conn, event: AnswerEvent)`: serialize to JSON, insert into `answer_events`
- `query_events_for_user(conn, username, since: DateTime<Local>) -> Vec<AnswerEvent>`: deserialize JSON blobs, filter by `username` and `timestamp >= since`
- `query_all_users(conn) -> Vec<UserProfile>`

#### RL Model (`src-tauri/src/rl/`)

**Feature vector** (per answer event in the recent window):
- Operand A: 13-dim one-hot
- Operand B: 13-dim one-hot
- `is_correct`: 1 scalar
- `normalized_response_time`: clamp(rt_ms / 10000, 0, 1)
- `time_since_last_seen_this_card`: exponential decay, scalar
- `card_seen_count_normalized` (over some time window): log-scaled, scalar
- Total per timestep: 30 features; sequence padded/truncated to last 300 events → input tensor `[200 × 30]`

**PolicyNet** (candle-nn):
- Flatten → Linear(6000, 256) → ReLU → Linear(256, 128) → ReLU
- Policy head: Linear(128, 169) → Softmax → card selection probabilities
- Difficulty head: Linear(128, 2) → Sigmoid → [scroll_speed_normalized, lane_count_normalized]

I think the model need only predict, for each card that's an option, what the user's 

**Reward signal** (per step):
Two different weighted reward components:
1. Show a card the user does poorly on, get points for that immediately, for discovering a player weakness: incentive to show the hard cards.
2. Improvements that "stuck".  For any card re-shown in the last N (~100 steps), model gets reward points for the product of: (number of timesteps since card was last shown) * (improvement in score on this time over the "worst case" score in the last 100 timestemps) (note that the worse case score for this card and the the most recently shown time might be different events).  So basically the model gets more points if improvements are large, and retained for a longer time.

The tradeoff between these should be a parameter called something like "find knowledge holes vs. reinforce learning"

**Training loop** (`trainer.rs`):
- `train_from_history(events: Vec<AnswerEvent>)`: build (state, action, reward) triples from history; run N gradient steps with AdamW
- `update_online(event: AnswerEvent)`: single gradient step after each answer
- Cold start (< `MIN_HISTORY_EVENTS` answers): `defaults::cold_start_policy()` returns uniform random card, speed=1.0, lanes=1

#### DDR Game Loop (`gameStore.ts` + `PlayTab.vue`)
- `gameStore` maintains `lanes: Lane[]` where each `Lane` has `cards: ScrollingCard[]`
- Animation: `requestAnimationFrame` loop updates `y` position of each card; card "age" tracked in ms
- `scrollSpeed` (px/s) received from RL after each answer; applied uniformly to all cards
- `pauseGame()`: sets `paused=true`, clears all `cards` from all lanes immediately
- `resumeGame()`: sets `paused=false`, calls RL for fresh card selections, spawns one card per active lane
- Lowest card: computed as `max(card.y)` across all active cards
- Answer routing: `submitAnswer(value)` finds the card with the highest `y` value; compares `parseInt(value)` to that card's `answer`; logs result; calls `update_online` via IPC

#### Proficiency Score (`utils/scoring.ts` + `composables/useProficiency.ts`)
- `MISS_PENALTY_MS = 10_000` (configurable constant)
- `computeProficiency(events, windowSize)`:
  - Take last `windowSize` events
  - Replace `response_time_ms` with `MISS_PENALTY_MS` for `is_correct=false`
  - Geometric mean = `exp(mean(log(speeds)))`
  - Score = `1000 / geometricMean` (scaled so ≈1.0 is "average")
- Sparkline: `useProficiency` composable maintains `scoreHistory: number[]` appended to after every answer in the current session

#### Sound Design (`composables/useAudio.ts`)
- All sounds synthesized via `AudioContext` oscillators; no file assets needed
- Tier → frequency/envelope mapping:
  - **Instant**: short high-pitched ding (sine, 880 Hz, 80 ms)
  - **Fast**: medium tone (sine, 660 Hz, 120 ms)
  - **Slow**: lower tone (triangle, 440 Hz, 200 ms)
  - **Miss**: descending glide (sawtooth, 300→150 Hz, 300 ms)
  - **Combo milestone**: ascending chord burst

#### File Association & Deep-Link (`tauri.conf.json` + `main.rs`)
- `tauri.conf.json`: register `flashcards` as handler for `.flashcards_sqlite` in `bundle.associations`
- `main.rs`: listen for `tauri://file-drop` and the OS open-with event; on receipt, call `open_db(path)` and update preferences

---

## Open Questions

1. **RL algorithm choice**: A simple policy-gradient (REINFORCE) approach over the flattened sequence is described, but an LSTM or attention-based sequence model would better capture temporal patterns. Decision needed on whether to implement a stateful RNN vs. the simpler flat-MLP approach given "fast retraining" constraint.

2. **Curiosity bonus formula**: Exact parameterization of `CuriosityBonus(card)` is intentionally deferred. Options include count-based bonuses (1/sqrt(n)), recency-decay (exp(-Δt/τ)), or a learned uncertainty estimate. The weight `β` and the functional form need empirical tuning.

3. **Reward horizon**: The spec says "cumulative proficiency improvement over a short horizon" but does not define the horizon length. Needs a concrete value (e.g., last 10 answers, last 2 minutes).

4. **Speed tier thresholds**: The default cutoffs (1 s / 3 s / 6 s) are placeholders. They should be validated against actual child performance data or made RL-tunable.

5. **Multi-lane answer routing ambiguity**: When two cards in different lanes are at the same vertical position (same `y`), the tie-breaking rule is not defined. Propose: prefer the leftmost lane; document this as a tunable rule.

6. **Scroll speed RL output range**: The difficulty head outputs a normalized [0,1] value. The mapping from normalized output to actual px/s needs a concrete range (e.g., 40–400 px/s) and whether it is linear or log-scaled.

7. **Number of lanes RL output**: The RL head outputs a continuous value that must map to a discrete integer (1–N). Proposed approach: round to nearest integer, clamp to [1, 5]. Max lanes (N) is hardcoded; should it be a config value?

8. **Proficiency score scaling**: `1000 / geometricMean` produces a score whose intuitive range is unclear. Should it be normalized against a population baseline? Define what a "good" score looks like.

9. **Candle vs. Burn**: Both are pure-Rust ML frameworks. Candle (Hugging Face) has more documentation; Burn has a more ergonomic training loop API. Decision needed before implementation begins.

10. **Session definition across crashes**: A "session" is one app run. If the app crashes and is reopened, is that the same session or a new one? Relevant for the session summary and "Last Session" stats filter.

11. **WAL file on Dropbox**: Dropbox does not sync SQLite WAL shim files (`-wal`, `-shm`) reliably. Users should be warned to close the app before Dropbox syncs, or the app should checkpoint the WAL before exit (`PRAGMA wal_checkpoint(FULL)`). This needs a documented user-facing warning.

12. **Combo persistence across pause**: Should the combo counter reset on pause/resume? The spec says cards are removed on pause (no peeking), implying a pause is a natural break — resetting the combo on resume seems reasonable but is unspecified.

---

## Testing Strategy

### 1. UI / Game-Loop Integration Tests (`tests/ui/`, Vitest + @testing-library/vue)

- **`game_loop.test.ts`**:
  - Mount `PlayTab.vue` with mocked Tauri IPC; assert that spawned cards have decreasing `y` over time frames.
  - Submit correct answer → assert the lowest card is removed, combo increments, `log_answer_event` IPC called with correct fields.
  - Submit wrong answer → assert Miss tier fires, combo resets to 0.
  - Card reaches `y = containerHeight` before answer → assert `is_correct=false` event logged, card removed.
  - Multi-lane: submit answer → assert it targets the card with the maximum `y` value across all lanes, not the first lane.
- **`pause_resume.test.ts`**:
  - Pause → assert `gameStore.cards` is empty across all lanes.
  - Attempt submit while paused → assert no IPC call fired, no state change.
  - Resume → assert fresh cards spawned; combo not affected (define expected behavior).

### 2. Unit Tests — Proficiency Scoring (`tests/unit/scoring.test.ts`)

- All correct Instant answers → score is a large number (high proficiency).
- All Misses → score = `1000 / MISS_PENALTY_MS_geomean` (very low).
- Mixed: one miss among N instants → geometric mean is dominated by the miss.
- Single-answer window → score equals `1000 / response_time_ms`.
- Empty event list → returns a defined sentinel (e.g., 0 or NaN handled gracefully).
- `windowSize` respected: only last N events used.

### 3. SQLite Logging Integrity Tests (`tests/integration/db_logging.test.ts`)

- Log one `AnswerEvent`; read it back; assert all required fields present and correctly typed: `uuid`, `question_uuid`, `question_content`, `username`, `timestamp` (valid ISO 8601 with TZ), `response_time_ms` (positive integer), `is_correct` (boolean), `app_version`.
- Log 100 events rapidly; assert count in DB equals 100 (no dropped writes).
- Open the same file from a second connection; assert WAL mode is active (`PRAGMA journal_mode` returns `wal`).
- Simulate a locked file; assert the Tauri command returns a `Locked` error, not a panic.
- User profile round-trip: insert, query, assert fields match.

### 4. RL Correctness Unit Tests (`tests/unit/rl_reward.test.rs` + `rl_convergence.test.rs`, Rust `#[cfg(test)]`)

- **`compute_reward`**:
  - All correct, fast answers → reward is positive.
  - Repeated misses on same card → curiosity bonus decreases (card is now "recently seen").
  - Card not seen in 100 steps → curiosity bonus is higher than card seen 1 step ago.
- **`update_online` convergence on synthetic data**:
  - Build a synthetic history where card `7×8` has 100% miss rate.
  - After training on this history, assert `select_next_card()` returns `7×8`'s index significantly more often than uniform random (p-value or frequency threshold).
  - After a synthetic "perfect session" on all cards, assert policy does not converge to one card (exploration maintained).
- **Cold start**: with zero history, assert `select_next_card()` returns each of the 169 cards with roughly equal probability over 1000 draws (chi-squared test or range check).
- **Model weight shapes**: assert `PolicyNet::new()` produces tensors of expected dimensions; forward pass on a zeroed input completes without error.