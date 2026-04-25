import type { CardMode, Question, RawCard, RawLevel } from '../types/level';

const DEFAULT_CHOICE_COUNT = 6;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(answer: string, pool: string[], n: number): string[] {
  const candidates = Array.from(new Set(pool.filter((x) => x !== answer)));
  return shuffle(candidates).slice(0, Math.max(0, n));
}

function resolveChoiceCount(level: RawLevel, card: RawCard, poolSize: number): number {
  const requested = card.choiceCount ?? level.choiceCount ?? DEFAULT_CHOICE_COUNT;
  // pool already excludes the correct answer; +1 for the correct answer slot
  const available = poolSize + 1;
  return Math.max(2, Math.min(requested, available));
}

/**
 * Expand a level into a randomised deck of questions.
 *
 * - multiple_choice translate cards become two questions (s→e and e→s).
 * - cards with promptDirection are kept fixed (used for grammar drills).
 * - spelling cards become a single typed-answer question (English → Sindarin).
 */
export function buildDeck(level: RawLevel): Question[] {
  const defaultMode: CardMode = level.defaultMode ?? 'multiple_choice';
  const out: Question[] = [];

  const sindarinPool = Array.from(new Set(level.cards.map((c) => c.sindarin)));
  const englishPool = Array.from(new Set(level.cards.map((c) => c.english)));

  for (const card of level.cards) {
    const mode: CardMode = card.mode ?? defaultMode;
    if (mode === 'spelling') {
      out.push(buildSpelling(card));
    } else if (card.promptDirection) {
      out.push(buildFixedDirection(card, level));
    } else {
      out.push(buildMC(card, level, 'sindarin', englishPool));
      out.push(buildMC(card, level, 'english', sindarinPool));
    }
  }

  return shuffle(out);
}

function buildMC(
  card: RawCard,
  level: RawLevel,
  promptLang: 'sindarin' | 'english',
  pool: string[],
): Question {
  const prompt = promptLang === 'sindarin' ? card.sindarin : card.english;
  const answer = promptLang === 'sindarin' ? card.english : card.sindarin;
  const distractorPool = pool.filter((x) => x !== answer);
  const total = resolveChoiceCount(level, card, distractorPool.length);
  const distractors = pickDistractors(answer, pool, total - 1);
  const choices = shuffle([answer, ...distractors]);
  return {
    key: `${card.sindarin}::${promptLang}`,
    prompt,
    promptIsElvish: promptLang === 'sindarin',
    answer,
    answerIsElvish: promptLang === 'english',
    mode: 'multiple_choice',
    choices,
    note: card.note,
  };
}

function buildFixedDirection(card: RawCard, level: RawLevel): Question {
  const promptIsElvish = card.promptDirection === 'sindarin';
  const prompt = promptIsElvish ? card.sindarin : card.english;
  const answer = promptIsElvish ? card.english : card.sindarin;
  const answerIsElvish = !promptIsElvish;
  const pool = Array.from(
    new Set(level.cards.map((c) => (promptIsElvish ? c.english : c.sindarin))),
  );
  const distractorPool = pool.filter((x) => x !== answer);
  const total = resolveChoiceCount(level, card, distractorPool.length);
  const distractors = pickDistractors(answer, pool, total - 1);
  const choices = shuffle([answer, ...distractors]);
  return {
    key: `${card.sindarin}::fixed`,
    prompt,
    promptIsElvish,
    promptLabel: card.promptLabel,
    answer,
    answerIsElvish,
    answerLabel: card.answerLabel,
    mode: 'multiple_choice',
    choices,
    note: card.note,
  };
}

function buildSpelling(card: RawCard): Question {
  return {
    key: `${card.sindarin}::spell`,
    prompt: card.english,
    promptIsElvish: false,
    answer: card.sindarin,
    answerIsElvish: true,
    mode: 'spelling',
    note: card.note,
  };
}

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
