import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { z } from 'zod/v4';
import { api } from '@/api/client';
import type { CaseStatus } from '@/api/client';

const caseStatusValues = [
  'intake', 'documents', 'review', 'ready_to_file', 'filed', 'discharged', 'dismissed', 'closed',
] as const;

const questionnaireSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  data: z.record(z.string(), z.unknown()),
  version: z.number(),
});

const clientSnapshotSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
}).passthrough();

const caseResponseSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  client: clientSnapshotSchema.optional(),
  chapter: z.string(),
  status: z.enum(caseStatusValues),
  filingDate: z.string().nullable(),
  filingDistrict: z.string().nullable().optional(),
  householdSize: z.number().nullable().optional(),
  isJointFiling: z.boolean().optional(),
  createdAt: z.string(),
  questionnaire: questionnaireSnapshotSchema.nullable().optional(),
});

export interface CaseData {
  id: string;
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  chapter: string;
  status: CaseStatus;
  filingDate: string | null;
  filingDistrict: string | null;
  householdSize: number | null;
  isJointFiling: boolean;
  createdAt: string;
}

export interface QuestionnaireSnapshot {
  id: string;
  name: string;
  data: Record<string, unknown>;
  version: number;
}

interface CaseContextValue {
  caseId: string;
  caseData: CaseData | null;
  questionnaire: QuestionnaireSnapshot | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CaseContext = createContext<CaseContextValue | null>(null);

function parseCaseResponse(rawData: Record<string, unknown>): {
  caseData: CaseData;
  questionnaire: QuestionnaireSnapshot | null;
} {
  const parsed = caseResponseSchema.parse(rawData);

  const caseData: CaseData = {
    id: parsed.id,
    clientId: parsed.clientId,
    clientFirstName: parsed.client?.firstName ?? '',
    clientLastName: parsed.client?.lastName ?? '',
    chapter: parsed.chapter,
    status: parsed.status,
    filingDate: parsed.filingDate,
    filingDistrict: parsed.filingDistrict ?? null,
    householdSize: parsed.householdSize ?? null,
    isJointFiling: parsed.isJointFiling ?? false,
    createdAt: parsed.createdAt,
  };

  const questionnaire = parsed.questionnaire ?? null;

  return { caseData, questionnaire };
}

function useCaseFetcher(caseId: string, clientMode: boolean) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const rawData = clientMode
        ? await api.clientGetCase(caseId)
        : await api.getCase(caseId);

      const result = parseCaseResponse(rawData);
      setCaseData(result.caseData);
      setQuestionnaire(result.questionnaire);
    } catch (err) {
      setError('Failed to load case data');
      console.error('Failed to load case data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, clientMode]);

  useEffect(() => {
    fetchCaseData();
  }, [fetchCaseData]);

  return { caseData, questionnaire, isLoading, error, refetch: fetchCaseData };
}

interface CaseProviderProps {
  children: ReactNode;
  caseId: string;
  clientMode?: boolean;
}

export function CaseProvider({ children, caseId, clientMode = false }: CaseProviderProps) {
  const { caseData, questionnaire, isLoading, error, refetch } = useCaseFetcher(caseId, clientMode);

  const contextValue: CaseContextValue = {
    caseId,
    caseData,
    questionnaire,
    isLoading,
    error,
    refetch,
  };

  return (
    <CaseContext.Provider value={contextValue}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCaseContext(): CaseContextValue {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCaseContext must be used within a CaseProvider');
  }
  return context;
}

export function useCaseData(caseId: string, clientMode?: boolean) {
  return useCaseFetcher(caseId, clientMode ?? false);
}