export type QuestionType = 'single' | 'multiple' | 'fill' | 'bool';

export interface Question {
  id: string;
  type: QuestionType;
  order: number;
  title: string;
  options: Record<string, string>;
  answer: string;
  analysis: string;
}

export type QuestionStatus = 'mastered' | 'learning' | 'weak';

export interface UserRecord {
  questionId: string;
  wrongCount: number;
  consecutiveCorrect: number;
  isBookmarked: boolean;
  status: QuestionStatus;
  lastAnswer: string;
  lastCorrect: boolean;
  updatedAt: number;
}

export interface DailyStat {
  date: string;
  total: number;
  correct: number;
}

export const TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  fill: '填空题',
  bool: '判断题',
};

export const TYPE_ORDER: QuestionType[] = ['single', 'multiple', 'fill', 'bool'];
