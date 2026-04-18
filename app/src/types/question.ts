import { v5 as uuidv5 } from 'uuid';

export interface Question {
  uuid: string;
  content: string;
  operandA: number;
  operandB: number;
  answer: number;
}

const APP_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function canonicalName(a: number, b: number): string {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return `${lo}*${hi}`;
}

export function canonicalUuid(a: number, b: number): string {
  return uuidv5(canonicalName(a, b), APP_NAMESPACE);
}

export function buildQuestionCatalog(): Question[] {
  const out: Question[] = [];
  for (let a = 0; a <= 12; a++) {
    for (let b = 0; b <= 12; b++) {
      out.push({
        uuid: canonicalUuid(a, b),
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
