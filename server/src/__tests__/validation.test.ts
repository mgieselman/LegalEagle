import { describe, it, expect } from 'vitest';
import { questionnaireDataSchema } from '../validation/questionnaire.schema';
import { createFormSchema, updateFormSchema } from '../validation/forms.schema';
import { seedFormData } from '../data/seedData';

describe('Questionnaire Zod Schema', () => {
  it('should accept valid seed data', () => {
    const result = questionnaireDataSchema.safeParse(seedFormData);
    if (!result.success) {
      console.error('Validation errors:', result.error.issues.slice(0, 5));
    }
    expect(result.success).toBe(true);
  });

  it('should reject non-object input', () => {
    const result = questionnaireDataSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('should reject null input', () => {
    const result = questionnaireDataSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('should reject missing required fields', () => {
    const result = questionnaireDataSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject wrong type for string fields', () => {
    const data = { ...seedFormData, fullName: 123 };
    const result = questionnaireDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject wrong type for array fields', () => {
    const data = { ...seedFormData, priorAddresses: 'not an array' };
    const result = questionnaireDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid nested object', () => {
    const data = { ...seedFormData, currentAddress: { street: 123 } };
    const result = questionnaireDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid array item shape', () => {
    const data = {
      ...seedFormData,
      unsecuredDebts: [{ wrongField: 'value' }],
    };
    const result = questionnaireDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('Form API Schemas', () => {
  it('createFormSchema should accept valid input', () => {
    const result = createFormSchema.safeParse({
      name: 'John Doe',
      data: { fullName: 'John Doe' },
    });
    expect(result.success).toBe(true);
  });

  it('createFormSchema should accept empty input', () => {
    const result = createFormSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('createFormSchema should reject empty name string', () => {
    const result = createFormSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('updateFormSchema should accept partial data', () => {
    const result = updateFormSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('updateFormSchema should accept partial questionnaire data', () => {
    const result = updateFormSchema.safeParse({
      data: { fullName: 'Jane Doe', ssn: '111-22-3333' },
    });
    expect(result.success).toBe(true);
  });
});
