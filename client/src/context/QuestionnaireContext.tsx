import { createContext, useContext, type ReactNode } from 'react';
import {
  useQuestionnaireState,
  type UseQuestionnaireStateReturn,
} from '@/hooks/useQuestionnaireState';
// Re-exported for consumer convenience
export type { QuestionnaireData, QuestionnaireValue } from '@/types/questionnaire';

const QuestionnaireContext = createContext<UseQuestionnaireStateReturn | null>(null);

interface QuestionnaireProviderProps {
  children: ReactNode;
  caseId?: string;
  mode?: 'staff' | 'client';
  questionnaireData?: { id: string; name: string; data: Record<string, unknown>; version: number };
  readOnly?: boolean;
}

export function QuestionnaireProvider({
  children,
  caseId,
  mode,
  questionnaireData,
  readOnly,
}: QuestionnaireProviderProps) {
  const state = useQuestionnaireState({ caseId, mode, questionnaireData, readOnly });

  return (
    <QuestionnaireContext.Provider value={state}>
      {children}
    </QuestionnaireContext.Provider>
  );
}

export function useQuestionnaireContext(): UseQuestionnaireStateReturn {
  const ctx = useContext(QuestionnaireContext);
  if (!ctx) {
    throw new Error('useQuestionnaireContext must be used within a QuestionnaireProvider');
  }
  return ctx;
}
