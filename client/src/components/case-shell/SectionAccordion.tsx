import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEVERITY_STYLES, SeverityIcon } from '@/components/ui/severity-indicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { sectionFindingSeverity } from '@/lib/review-mapping';
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
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.add(target.key);
      return next;
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
              className="w-full flex items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors cursor-pointer"
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
                  <Component data={data} onChange={onChange} readOnly={readOnly} />
                </ErrorBoundary>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
