import { describe, it, expect } from 'vitest';
import { extractW2ByFormFields } from '../services/extraction/ruleExtractors/w2';

describe('extractW2ByFormFields', () => {
  describe('field name mapping', () => {
    it('maps box1/wages field to wages', () => {
      const result = extractW2ByFormFields({ f2_1: '52000.00' });
      expect(result.data.wages).toBe(52000.00);
    });

    it('maps box2/federal_tax field to federal_tax_withheld', () => {
      const result = extractW2ByFormFields({ f2_2: '8000.00' });
      expect(result.data.federal_tax_withheld).toBe(8000.00);
    });

    it('maps wages keyword to wages field', () => {
      const result = extractW2ByFormFields({ wages_box1: '75000.00' });
      expect(result.data.wages).toBe(75000.00);
    });

    it('maps federal keyword to federal_tax_withheld', () => {
      const result = extractW2ByFormFields({ federal_income: '12000.00' });
      expect(result.data.federal_tax_withheld).toBe(12000.00);
    });

    it('maps ss_wages field to social_security_wages (not plain wages)', () => {
      const result = extractW2ByFormFields({ ss_wages: '52000.00' });
      expect(result.data.social_security_wages).toBe(52000.00);
      expect(result.data.wages).toBeUndefined();
    });

    it('maps medicare keyword to medicare_wages (not plain wages)', () => {
      const result = extractW2ByFormFields({ medicare_wages_box5: '52000.00' });
      expect(result.data.medicare_wages).toBe(52000.00);
      expect(result.data.wages).toBeUndefined();
    });

    it('truncates SSN to last 4 digits', () => {
      const result = extractW2ByFormFields({ employee_ssn: '123-45-6789' });
      expect(result.data.employee_ssn_last4).toBe('6789');
    });

    it('stores employer_ein as-is', () => {
      const result = extractW2ByFormFields({ ein: '25-0965591' });
      expect(result.data.employer_ein).toBe('25-0965591');
    });
  });

  describe('confidence scoring', () => {
    it('returns confidence >= 0.90 when 4+ dollar boxes found', () => {
      const result = extractW2ByFormFields({
        f2_1: '52000.00',
        f2_2: '8000.00',
        f2_3: '52000.00',
        f2_4: '3224.00',
        f2_5: '52000.00',
        f2_6: '754.00',
      });
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });

    it('returns confidence < 0.85 when fewer than 4 dollar boxes found', () => {
      const result = extractW2ByFormFields({ f2_1: '52000.00', f2_2: '8000.00' });
      expect(result.confidence).toBeLessThan(0.85);
    });

    it('returns confidence 0 when no form fields provided', () => {
      const result = extractW2ByFormFields({});
      expect(result.confidence).toBe(0);
      expect(result.warnings.some((w) => w.includes('No PDF form fields'))).toBe(true);
    });
  });

  describe('full W-2 with all 6 boxes', () => {
    it('extracts all required fields correctly', () => {
      const result = extractW2ByFormFields({
        f2_1: '52,000.00',
        f2_2: '8,000.00',
        f2_3: '52,000.00',
        f2_4: '3,224.00',
        f2_5: '52,000.00',
        f2_6: '754.00',
        employer_name: 'University of Pittsburgh',
        ein: '25-0965591',
        employee_name: 'John Doe',
        tax_year: '2024',
      });
      expect(result.data.wages).toBe(52000.00);
      expect(result.data.federal_tax_withheld).toBe(8000.00);
      expect(result.data.social_security_wages).toBe(52000.00);
      expect(result.data.social_security_tax).toBe(3224.00);
      expect(result.data.medicare_wages).toBe(52000.00);
      expect(result.data.medicare_tax).toBe(754.00);
      expect(result.data.employer_name).toBe('University of Pittsburgh');
      expect(result.data.employer_ein).toBe('25-0965591');
      expect(result.confidence).toBeGreaterThanOrEqual(0.90);
    });
  });
});
