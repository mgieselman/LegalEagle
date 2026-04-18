import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { SEVERITY_STYLES, SeverityIcon } from './ui/severity-indicator';
import { AutoSaveIndicator } from './ui/auto-save-indicator';
import { ReviewPanel } from './ReviewPanel';
import { sectionNameToKey, sectionFindingSeverity, findingsForSection } from '@/lib/review-mapping';
import { ALL_SECTIONS } from '@/lib/section-registry';
import { getSectionStatus } from '@/lib/completion';
import type { ReviewFinding } from '@/api/client';
import { ChevronDown, ChevronRight, Plus, Save, Search, Download, Menu, X } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { ErrorBoundary } from './ErrorBoundary';
import { useQuestionnaireState } from '@/hooks/useQuestionnaireState';

interface FormShellProps {
  caseId?: string;
  mode?: 'staff' | 'client';
  questionnaireData?: { id: string; name: string; data: Record<string, unknown>; version: number };
  readOnly?: boolean;
}

export function FormShell({ caseId, mode = 'staff', questionnaireData, readOnly = false }: FormShellProps = {}) {
  // Core questionnaire state from hook
  const q = useQuestionnaireState({ caseId, mode, questionnaireData, readOnly });

  // UI-only state
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['1']));
  const [reviewCollapsed, setReviewCollapsed] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Surface messages from the hook as toasts
  useEffect(() => {
    if (q.lastMessage) {
      // Async state update to avoid cascading renders
      Promise.resolve().then(() => {
        showToast(q.lastMessage);
        q.clearMessage();
      });
    }
  }, [q.lastMessage, q]);

  // Reset review UI when review starts
  useEffect(() => {
    if (q.hasReview) {
      // Async state update to avoid cascading renders  
      Promise.resolve().then(() => {
        setReviewCollapsed(false);
      });
    }
  }, [q.hasReview]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleFindingClick = (finding: ReviewFinding) => {
    const key = sectionNameToKey(finding.section) || sectionNameToKey(finding.message);
    if (key) {
      setOpenSections((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setHighlightedSection(key);
      setTimeout(() => {
        const el = document.getElementById(`section-${key}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      setTimeout(() => setHighlightedSection(null), 3000);
    }
  };

  const formOptions = q.formList.map((f) => (
    <option key={f.id} value={f.id}>
      {f.name} ({new Date(f.updated_at).toLocaleDateString()})
    </option>
  ));

  const withMenuClose = (fn: () => void) => () => { fn(); setMobileMenuOpen(false); };

  return (
    <div className="min-h-screen bg-background max-w-full overflow-x-hidden">
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-background border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-lg font-bold mr-2 truncate">Bankruptcy Questionnaire</h1>
          <div className="flex-1" />
          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-3">
            {!caseId && (
              <>
                <Select
                  value={q.currentFormId || ''}
                  onChange={(e) => q.handleSelectForm(e.target.value)}
                  className="w-56"
                >
                  <option value="">Select a form...</option>
                  {formOptions}
                </Select>
                <Button variant="outline" size="sm" onClick={q.handleNewForm} className="gap-1">
                  <Plus className="h-4 w-4" /> New Form
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={q.handleSave}
              disabled={q.saving || q.readOnly}
              className="gap-1"
              title={q.readOnly ? 'Form is read-only (case has been filed)' : undefined}
            >
              <Save className="h-4 w-4" /> {q.saving ? 'Saving...' : q.readOnly ? 'Read-only' : 'Save'}
            </Button>
            {/* Auto-save status */}
            {q.currentFormId && <AutoSaveIndicator status={q.autoSave.status} />}
            {mode === 'staff' && (
              <>
                <Button variant="outline" size="sm" onClick={q.handleDownload} disabled={!q.currentFormId} className="gap-1">
                  <Download className="h-4 w-4" /> Download
                </Button>
                <Button size="sm" onClick={q.handleReview} disabled={q.reviewing} className="gap-1">
                  <Search className="h-4 w-4" /> {q.reviewing ? 'Reviewing...' : 'Review'}
                </Button>
              </>
            )}
          </div>
          {/* Mobile hamburger */}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen((o) => !o)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <>
          <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="md:hidden border-t px-4 py-3 space-y-3 bg-background relative z-40">
            {!caseId && (
              <>
                <Select
                  value={q.currentFormId || ''}
                  onChange={(e) => { q.handleSelectForm(e.target.value); setMobileMenuOpen(false); }}
                  className="w-full"
                >
                  <option value="">Select a form...</option>
                  {formOptions}
                </Select>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {!caseId && (
                <Button variant="outline" size="sm" onClick={withMenuClose(q.handleNewForm)} className="gap-1 flex-1">
                  <Plus className="h-4 w-4" /> New
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={withMenuClose(() => { q.handleSave(); })}
                disabled={q.saving || q.readOnly}
                className="gap-1 flex-1"
                title={q.readOnly ? 'Form is read-only (case has been filed)' : undefined}
              >
                <Save className="h-4 w-4" /> {q.saving ? 'Saving...' : q.readOnly ? 'Read-only' : 'Save'}
              </Button>
              {/* Mobile auto-save status */}
              {q.currentFormId && (
                <div className="flex items-center justify-center px-2 py-1 rounded">
                  <AutoSaveIndicator status={q.autoSave.status} />
                </div>
              )}
              {mode === 'staff' && (
                <Button variant="outline" size="sm" onClick={withMenuClose(() => { q.handleDownload(); })} disabled={!q.currentFormId} className="gap-1 flex-1">
                  <Download className="h-4 w-4" /> Download
                </Button>
              )}
            </div>
            {mode === 'staff' && (
              <Button size="sm" onClick={withMenuClose(() => { q.handleReview(); })} disabled={q.reviewing} className="gap-1 w-full">
                <Search className="h-4 w-4" /> {q.reviewing ? 'Reviewing...' : 'Review'}
              </Button>
            )}
          </div>
          </>
        )}
      </div>

      {/* Progress bar (client mode only) */}
      {mode === 'client' && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <ProgressBar data={q.data} />
        </div>
      )}

      {/* Form sections */}
      <div className={`max-w-5xl mx-auto px-4 py-6 w-full box-border ${mode === 'staff' && q.hasReview && !reviewCollapsed ? 'md:mr-[420px]' : ''}`}>
        <div className="space-y-2">
          {ALL_SECTIONS.map(({ key, title, Component }) => {
            const isOpen = openSections.has(key);
            const severity = sectionFindingSeverity(key, q.findings);
            const isHighlighted = highlightedSection === key;
            const sectionStatus = getSectionStatus(q.data, key);
            const severityBorder = severity
              ? `${SEVERITY_STYLES[severity].border} border-2`
              : 'border';
            const highlightClass = isHighlighted ? 'ring-2 ring-offset-2 ring-primary transition-all' : '';
            const completeBg = sectionStatus === 'complete' ? 'bg-green-50 dark:bg-green-950/20' : '';
            return (
              <div key={key} id={`section-${key}`} className={`rounded-lg overflow-hidden ${severityBorder} ${highlightClass}`}>
                <button
                  className={`w-full flex items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors cursor-pointer ${completeBg}`}
                  onClick={() => toggleSection(key)}
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  {title}
                  {severity && (
                    <SeverityIcon severity={severity} className="ml-auto h-2.5 w-2.5 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <ErrorBoundary sectionName={title}>
                      <Component data={q.data} onChange={q.handleChange} readOnly={q.readOnly} findings={findingsForSection(key, q.findings)} />
                    </ErrorBoundary>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Review panel (staff only) */}
      {mode === 'staff' && q.hasReview && (
        <ReviewPanel
          findings={q.findings}
          loading={q.reviewing}
          collapsed={reviewCollapsed}
          onToggle={() => { setReviewCollapsed((c) => !c); setHighlightedSection(null); }}
          onFindingClick={handleFindingClick}
        />
      )}

      {/* Footer */}
      <div className={`border-t mt-8 py-3 text-center text-xs text-muted-foreground ${q.hasReview && !reviewCollapsed ? 'md:mr-[420px]' : ''}`}>
        LegalEagle v{__APP_VERSION__} &middot; Built {__BUILD_TIME__}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 bg-foreground text-background px-4 py-2 rounded-md shadow-lg text-sm z-[60] animate-in fade-in text-center md:text-left">
          {toast}
        </div>
      )}
    </div>
  );
}
