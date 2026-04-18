import { v5 as uuidv5 } from 'uuid';

export interface Question {
  uuid: string;
  content: string;
  operandA: number;
  operandB: number;
  answer: number;
}

const APP_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Each (a, b) ordering is its own card. Multiplication is commutative
// mathematically, but "produce 12×8 quickly" and "produce 8×12 quickly" are
// separately learned skills — kids (and adults) often have asymmetric recall.
// Tracking them separately lets the selector drill the weaker order without
// the knowledge of the stronger one masking the gap.
//
// Migration note: events logged before this change used a canonical
// `min(a,b)*max(a,b)` UUID, so they only match the new card whose operand
// order happens to be non-decreasing. The reversed-order cards start fresh
// — one-time ramp the selector will re-explore them from unseen.
export function questionName(a: number, b: number): string {
  return `${a}*${b}`;
}

export function questionUuid(a: number, b: number): string {
  return uuidv5(questionName(a, b), APP_NAMESPACE);
}

export function buildQuestionCatalog(): Question[] {
  const out: Question[] = [];
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      out.push({
        uuid: questionUuid(a, b),
        content: `${a} \u00d7 ${b}`,
        operandA: a,
        operandB: b,
        answer: a * b,
      });
    }
  }
  return out;
}

export const QUESTION_CATALOG: Question[] = buildQuestionCatalog();

export function getQuestionByUuid(uuid: string): Question | undefined {
  return QUESTION_CATALOG.find((q) => q.uuid === uuid);
}

export function getQuestionByOperands(a: number, b: number): Question {
  return QUESTION_CATALOG.find((q) => q.operandA === a && q.operandB === b)!;
}
