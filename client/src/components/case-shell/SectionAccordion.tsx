import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEVERITY_STYLES, SeverityIcon } from '@/components/ui/severity-indicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { findingToSectionKey, findingsForSection, sectionFindingSeverity } from '@/lib/review-mapping';
import { useSectionNav } from '@/context/SectionNavContext';
import type { SectionDefinition } from '@/lib/section-registry';
import type { QuestionnaireData, QuestionnaireValue } from '@/types/questionnaire';
import type { ReviewFinding } from '@/api/client';

interface SectionAccordionProps {
  sections: SectionDefinition[];
  data: QuestionnaireData;
  onChange: (path: string, value: QuestionnaireValue) => void;
  readOnly?: boolean;
  findings?: ReviewFinding[];
}

export function SectionAccordion({
  sections,
  data,
  onChange,
  readOnly,
  findings = [],
}: SectionAccordionProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (sections.length > 0) {
      initial.add(sections[0].key);
    }
    return initial;
  });

  const { target } = useSectionNav();
  const pendingScrollRef = useRef<string | null>(null);

  // Phase 1: open the section (triggers re-render)
  useEffect(() => {
    if (!target) return;
    pendingScrollRef.current = target.key;
    // Async state update to avoid cascading renders
    Promise.resolve().then(() => {
      setOpenSections((prev) => {
        const next = new Set(prev);
        next.add(target.key);
        return next;
      });
    });
  }, [target]);

  // Phase 2: scroll after the re-render commits the expanded content
  useEffect(() => {
    const key = pendingScrollRef.current;
    if (!key || !openSections.has(key)) return;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => {
      document.getElementById(`section-${key}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [openSections]);

  // Auto-expand every section that has at least one finding so inline banners are visible
  useEffect(() => {
    if (findings.length === 0) return;
    Promise.resolve().then(() => {
      setOpenSections((prev) => {
        const next = new Set(prev);
        findings.forEach((f) => {
          const k = findingToSectionKey(f);
          if (k) next.add(k);
        });
        return next;
      });
    });
  }, [findings]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {sections.map(({ key, title, Component }) => {
        const isOpen = openSections.has(key);
        const severity = sectionFindingSeverity(key, findings);
        const sectionFindings = findingsForSection(key, findings);
        const severityBorder = severity
          ? `${SEVERITY_STYLES[severity].border} border-2`
          : 'border';

        return (
          <div
            key={key}
            id={`section-${key}`}
            className={cn('rounded-lg overflow-hidden', severityBorder)}
          >
            <button
              className="w-full px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => toggleSection(key)}
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span>{title}</span>
                {severity && (
                  <SeverityIcon severity={severity} className="ml-auto h-3.5 w-3.5 shrink-0" />
                )}
              </div>
              {severity && !isOpen && sectionFindings.length > 0 && (
                <p className={`ml-6 mt-1 text-xs font-normal ${SEVERITY_STYLES[severity].text}`}>
                  {sectionFindings[0].message.length > 80
                    ? sectionFindings[0].message.slice(0, 80) + '…'
                    : sectionFindings[0].message}
                  {sectionFindings.length > 1 && ` (+${sectionFindings.length - 1} more)`}
                </p>
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <ErrorBoundary sectionName={title}>
                  <Component
                    data={data}
                    onChange={onChange}
                    readOnly={readOnly}
                    findings={sectionFindings}
                  />
                </ErrorBoundary>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
