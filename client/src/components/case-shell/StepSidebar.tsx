import { useState } from 'react';
import { NavLink } from 'react-router';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStepStatus, getSubSectionStatus, type SectionStatus } from '@/lib/completion';
import { useSectionNav } from '@/context/SectionNavContext';
import type { StepConfig, SidebarSection } from '@/lib/step-configs';
import type { QuestionnaireData } from '@/types/questionnaire';

interface StepSidebarProps {
  steps: StepConfig[];
  activeStepKey: string;
  data: QuestionnaireData | null;
  onNavigate?: () => void; // called on item click (for mobile drawer close)
}

function CompletionIndicator({ status, size = 'md' }: { status: SectionStatus; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (status === 'complete') {
    return (
      <div className={cn(dims, 'rounded-full bg-primary flex items-center justify-center shrink-0')}>
        <Check className={size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'} strokeWidth={3} color="white" />
      </div>
    );
  }
  if (status === 'in-progress') {
    return (
      <div className={cn(dims, 'rounded-full border-2 border-primary shrink-0')}>
        <div className="h-full w-full rounded-full bg-primary/30" />
      </div>
    );
  }
  return <div className={cn(dims, 'rounded-full border-2 border-muted-foreground/30 shrink-0')} />;
}

function SectionList({
  sections,
  data,
  onNavigate,
}: {
  sections: SidebarSection[];
  data: QuestionnaireData | null;
  onNavigate?: () => void;
}) {
  const { navigateToSection } = useSectionNav();
  
  // Use useMemo to track group headers properly without variable reassignment during render
  const sectionsWithGroupHeaders = useMemo(() => {
    return sections.reduce<{ lastGroup: string | undefined; items: Array<typeof sections[number] & { subStatus: ReturnType<typeof getSubSectionStatus>; showGroupHeader: boolean | undefined }> }>(
      (acc, section) => {
        const subStatus = getSubSectionStatus(section, data);
        const showGroupHeader = section.group && section.group !== acc.lastGroup;
        acc.items.push({ ...section, subStatus, showGroupHeader });
        return { lastGroup: section.group, items: acc.items };
      },
      { lastGroup: undefined, items: [] }
    ).items;
  }, [sections, data]);

  return (
    <div className="ml-6 border-l border-muted space-y-0.5">
      {sectionsWithGroupHeaders.map((section) => {
        return (
          <div key={section.key}>
            {section.showGroupHeader && (
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.group}
              </div>
            )}
            <button
              className="flex items-center gap-2 w-full px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-left"
              onClick={() => {
                navigateToSection(section.sectionKeys[0]);
                onNavigate?.();
              }}
            >
              <CompletionIndicator status={subStatus} size="sm" />
              <span className="truncate">{section.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function StepSidebar({ steps, activeStepKey, data, onNavigate }: StepSidebarProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set([activeStepKey]));

  const toggleExpanded = (key: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <nav className="py-4 space-y-1">
      {steps.map((step) => {
        const isActive = step.key === activeStepKey;
        const status = getStepStatus(step, data);
        const hasSections = step.sections && step.sections.length > 0;
        const isExpanded = expandedSteps.has(step.key);

        return (
          <div key={step.key}>
            {/* Step item */}
            <NavLink
              to={step.key}
              onClick={() => {
                if (hasSections) {
                  toggleExpanded(step.key);
                }
                onNavigate?.();
              }}
              aria-expanded={hasSections ? isExpanded : undefined}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-muted/50',
                isActive && 'border-l-2 border-primary bg-muted/30 font-medium',
                !isActive && 'border-l-2 border-transparent',
              )}
            >
              <CompletionIndicator status={status} />
              <span className="truncate">{step.label}</span>
              {hasSections && (
                <span className="ml-auto">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </span>
              )}
            </NavLink>

            {/* Sub-sections */}
            {hasSections && isExpanded && (
              <SectionList
                sections={step.sections!}
                data={data}
                onNavigate={onNavigate}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
