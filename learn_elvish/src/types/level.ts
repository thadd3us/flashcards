export type CardMode = 'multiple_choice' | 'spelling';

export interface RawCard {
  sindarin: string;
  english: string;
  mode?: CardMode;
  /**
   * If set, the card is treated as a fixed-direction prompt/answer pair (used
   * for grammar drills like singular→plural). Otherwise translate cards are
   * expanded into both directions (sindarin↔english).
   */
  promptDirection?: 'sindarin' | 'english';
  promptLabel?: string;
  answerLabel?: string;
  note?: string;
  /** Override total choice count (including the correct answer) for this card. */
  choiceCount?: number;
}

export interface RawLevel {
  id: string;
  name: string;
  description: string;
  defaultMode?: CardMode;
  /** Total choice count (including the correct answer) for multiple-choice cards in this level. */
  choiceCount?: number;
  cards: RawCard[];
}

export interface LevelsFile {
  title: string;
  subtitle: string;
  levels: RawLevel[];
}

export interface Question {
  key: string;
  prompt: string;
  promptIsElvish: boolean;
  promptLabel?: string;
  answer: string;
  answerIsElvish: boolean;
  answerLabel?: string;
  mode: CardMode;
  choices?: string[];
  note?: string;
}
