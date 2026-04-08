import { QuestionnaireData } from '@/types/questionnaire';
import { YesNoField, TextAreaField } from '@/components/FormField';

interface Props {
  data: QuestionnaireData;
  onChange: (path: string, value: any) => void;
}

export function Section20Accidents({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 20: Accidents</h3>

      <YesNoField
        label="Have you been involved in a vehicle accident?"
        value={data.vehicleAccident}
        onChange={(v) => onChange('vehicleAccident', v)}
      />

      <YesNoField
        label="Was your vehicle involved in an accident?"
        value={data.vehicleInAccident}
        onChange={(v) => onChange('vehicleInAccident', v)}
      />

      <YesNoField
        label="Have your children injured others?"
        value={data.childrenInjuredOthers}
        onChange={(v) => onChange('childrenInjuredOthers', v)}
      />

      <YesNoField
        label="Have you lost your driver's license?"
        value={data.lostDriversLicense}
        onChange={(v) => onChange('lostDriversLicense', v)}
      />
      {data.lostDriversLicense === 'yes' && (
        <TextAreaField
          label="Details about lost license"
          value={data.lostLicenseDetails}
          onChange={(v) => onChange('lostLicenseDetails', v)}
        />
      )}
    </div>
  );
}
