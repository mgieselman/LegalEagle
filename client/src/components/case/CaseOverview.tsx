import { Link } from 'react-router';
import { FileText, ClipboardList } from 'lucide-react';
import { useCaseContext } from '@/context/CaseContext';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProgressBar } from '@/components/ProgressBar';
import { CaseStageTracker } from '@/components/CaseStageTracker';
import type { QuestionnaireData } from '@/types/questionnaire';

interface CaseOverviewProps {
  mode: 'staff' | 'client';
}

export function CaseOverview({ mode }: CaseOverviewProps) {
  const { caseData, questionnaire } = useCaseContext();

  if (!caseData) {
    return <div className="p-6 text-muted-foreground">No case data available</div>;
  }

  const clientName = `${caseData.clientFirstName} ${caseData.clientLastName}`;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={mode === 'staff' ? `Case: ${clientName}` : 'Case Overview'}
        subtitle={`Chapter ${caseData.chapter} bankruptcy case`}
      />

      {/* 9-stage case pipeline tracker */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Case Progress</h3>
        <CaseStageTracker caseData={caseData} />
      </Card>

      {mode === 'staff' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Case Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Client</label>
              <p className="text-sm">{clientName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Chapter</label>
              <p className="text-sm">Chapter {caseData.chapter}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <StatusBadge status={caseData.status} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Household Size</label>
              <p className="text-sm">{caseData.householdSize || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Joint Filing</label>
              <p className="text-sm">{caseData.isJointFiling ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Filing Date</label>
              <p className="text-sm">{caseData.filingDate || 'Not filed'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Filing District</label>
              <p className="text-sm">{caseData.filingDistrict || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm">{new Date(caseData.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>
      )}

      {questionnaire && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Questionnaire Progress</h3>
          <ProgressBar data={questionnaire.data as QuestionnaireData} />
        </Card>
      )}

      {mode === 'client' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">What to do next</h3>
          <div className="space-y-3">
            <Link
              to="documents"
              className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Upload Documents</p>
                <p className="text-xs text-muted-foreground">
                  Upload required financial documents and supporting papers
                </p>
              </div>
            </Link>
            <Link
              to="questionnaire"
              className="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Complete Questionnaire</p>
                <p className="text-xs text-muted-foreground">
                  Fill out your financial and personal information
                </p>
              </div>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}