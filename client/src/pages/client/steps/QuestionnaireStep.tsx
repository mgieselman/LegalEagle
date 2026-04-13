import { useQuestionnaireContext } from '@/context/QuestionnaireContext';
import { SectionAccordion } from '@/components/case-shell/SectionAccordion';
import { ALL_SECTIONS } from '@/lib/section-registry';

export function QuestionnaireStep() {
  const { data, handleChange, readOnly, findings } = useQuestionnaireContext();

  return (
    <div className="p-6">
      <SectionAccordion
        sections={ALL_SECTIONS}
        data={data}
        onChange={handleChange}
        readOnly={readOnly}
        findings={findings}
      />
    </div>
  );
}
