export type StudyLanguage = 'pl' | 'en';
export type Scope = 'all' | 'colloquium' | 'exam';
export type MaterialCat = 'exam' | 'colloquium' | 'lecture' | 'lab' | 'other';
export type Format = 'html' | 'md' | 'text';

export interface Answer {
  t: string;
  c: boolean;
  f: Format;
}

export interface QuestionComment {
  by: string;
  t: string;
  at: number | string | null;
}

/** A question as stored in a bank file or added by the user. */
export interface RawQuestion {
  id: string;
  q: string;
  f: Format;
  a: Answer[];
  code?: string;
  why?: string;
  back?: string;
  scope?: Scope;
  tags?: string[];
  cm?: QuestionComment[];
  /** Material file the question was extracted from. */
  src?: string;
  /** Set only on English questions. */
  l?: 'en';
}

export interface Bank {
  id: string;
  title: string;
  count: number;
  /** How many of the questions are in English. */
  en: number;
  scope: Scope;
  source: 'zdajse' | 'ppj' | 'community' | 'mined';
  url?: string;
}

export interface FileCounts {
  exam: number;
  colloquium: number;
  lecture: number;
  lab: number;
  other: number;
  total: number;
  usable: number;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  level: 'inz' | 'mgr';
  sem: string | null;
  official: boolean;
  elective: boolean;
  banks: Bank[];
  files: FileCounts | null;
}

export interface Catalog {
  generatedAt: number;
  programUrl: string;
  courses: Course[];
}

export type MaterialFile = [path: string, category: MaterialCat];

/** The one shape every study mode works with. */
export interface Card {
  id: string;
  courseId: string;
  sourceId: string;
  sourceLabel: string;
  front: string;
  format: Format;
  code?: string;
  back?: string;
  answers: Answer[];
  why?: string;
  scope: Scope;
  tags: string[];
  comments: QuestionComment[];
  src?: string;
}

export type DraftType = 'qa' | 'mcq' | 'open' | 'definition' | 'outline' | 'cloze';

export interface Draft {
  front: string;
  back: string;
  type: DraftType;
  file?: string;
  answers?: { t: string; c: boolean }[];
}

export interface DeckCard extends Draft {
  id: string;
}

export interface Deck {
  id: string;
  courseId: string;
  name: string;
  scope: Scope;
  createdAt: number;
  cards: DeckCard[];
}

export type StudyMode = 'flashcards' | 'review' | 'learn' | 'write' | 'test' | 'match' | 'truefalse' | 'open';
