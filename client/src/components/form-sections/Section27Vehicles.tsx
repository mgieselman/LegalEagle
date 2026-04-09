import { VehicleEntry, SectionProps } from '@/types/questionnaire';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const INTENTION_OPTIONS = [
  { value: 'retain', label: 'Retain' },
  { value: 'reaffirm', label: 'Reaffirm' },
  { value: 'surrender', label: 'Surrender' },
  { value: 'redeem', label: 'Redeem' },
];

function createEmptyVehicle(): VehicleEntry {
  return {
    lenderName: '',
    lenderAddress: '',
    loanNumber: '',
    percentageRate: '',
    yearPurchased: '',
    makeYearModel: '',
    mileage: '',
    condition: '',
    approximateValue: '',
    intention: '',
  };
}

export function Section27Vehicles({ data, onChange }: SectionProps) {
  const vehicles = data.vehicles || [];

  const addVehicle = () => {
    onChange('vehicles', [...vehicles, createEmptyVehicle()]);
  };

  const removeVehicle = (index: number) => {
    onChange('vehicles', vehicles.filter((_: VehicleEntry, i: number) => i !== index));
  };

  const updateVehicle = (index: number, field: string, value: string) => {
    const updated = vehicles.map((v: VehicleEntry, i: number) =>
      i === index ? { ...v, [field]: value } : v
    );
    onChange('vehicles', updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Section 27: Vehicles</h3>

      {vehicles.map((vehicle: VehicleEntry, index: number) => (
        <div key={index} className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium">Vehicle {index + 1}</h4>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeVehicle(index)}
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField
              label="Make / Year / Model"
              value={vehicle.makeYearModel}
              onChange={(v) => updateVehicle(index, 'makeYearModel', v)}
              placeholder="e.g. 2018 Honda Civic"
            />
            <FormField
              label="Year Purchased"
              value={vehicle.yearPurchased}
              onChange={(v) => updateVehicle(index, 'yearPurchased', v)}
              placeholder="YYYY"
            />
            <FormField
              label="Lender Name"
              value={vehicle.lenderName}
              onChange={(v) => updateVehicle(index, 'lenderName', v)}
              placeholder="Lender name"
            />
            <FormField
              label="Lender Address"
              value={vehicle.lenderAddress}
              onChange={(v) => updateVehicle(index, 'lenderAddress', v)}
              placeholder="Lender address"
            />
            <FormField
              label="Loan Number"
              value={vehicle.loanNumber}
              onChange={(v) => updateVehicle(index, 'loanNumber', v)}
              placeholder="Loan #"
            />
            <FormField
              label="Interest Rate (%)"
              value={vehicle.percentageRate}
              onChange={(v) => updateVehicle(index, 'percentageRate', v)}
              placeholder="e.g. 5.9"
            />
            <FormField
              label="Mileage"
              value={vehicle.mileage}
              onChange={(v) => updateVehicle(index, 'mileage', v)}
              placeholder="e.g. 45000"
            />
            <FormField
              label="Condition"
              value={vehicle.condition}
              onChange={(v) => updateVehicle(index, 'condition', v)}
              placeholder="Good / Fair / Poor"
            />
            <FormField
              label="Approximate Value"
              value={vehicle.approximateValue}
              onChange={(v) => updateVehicle(index, 'approximateValue', v)}
              placeholder="$0.00"
            />
          </div>

          <div>
            <span className="text-sm font-medium block mb-2">Intention</span>
            <div className="flex flex-wrap gap-4">
              {INTENTION_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name={`vehicle-intention-${index}`}
                    checked={vehicle.intention === opt.value}
                    onChange={() => updateVehicle(index, 'intention', opt.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addVehicle} className="gap-1">
        <Plus className="h-4 w-4" /> Add Vehicle
      </Button>
    </div>
  );
}
