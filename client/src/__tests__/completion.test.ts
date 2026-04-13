import { describe, it, expect } from 'vitest';
import { createEmptyQuestionnaire } from '@/types/questionnaire';
import {
  calculateSectionCompletion,
  calculateStepCompletion,
  getSectionStatus,
  calculateOverallCompletion,
  SECTION_FIELD_MAP,
} from '@/lib/completion';

describe('completion utilities', () => {
  describe('SECTION_FIELD_MAP', () => {
    it('covers all 27 sections', () => {
      for (let i = 1; i <= 27; i++) {
        expect(SECTION_FIELD_MAP[String(i)]).toBeDefined();
        expect(SECTION_FIELD_MAP[String(i)].length).toBeGreaterThan(0);
      }
    });

    it('maps valid QuestionnaireData keys', () => {
      const empty = createEmptyQuestionnaire();
      const validKeys = new Set(Object.keys(empty));
      for (const [sectionKey, fields] of Object.entries(SECTION_FIELD_MAP)) {
        for (const field of fields) {
          expect(validKeys.has(field), `Section ${sectionKey}: "${field}" is not a valid QuestionnaireData key`).toBe(true);
        }
      }
    });
  });

  describe('calculateSectionCompletion', () => {
    it('returns 0 for empty questionnaire section', () => {
      const data = createEmptyQuestionnaire();
      // Section 25 (Unsecured Debts) only has an array field, empty by default
      expect(calculateSectionCompletion(data, '25')).toBe(0);
    });

    it('returns 0 for invalid section key', () => {
      const data = createEmptyQuestionnaire();
      expect(calculateSectionCompletion(data, '999')).toBe(0);
    });

    it('returns > 0 when some fields are filled', () => {
      const data = createEmptyQuestionnaire();
      data.fullName = 'John Doe';
      data.phone = '555-1234';
      const pct = calculateSectionCompletion(data, '1');
      expect(pct).toBeGreaterThan(0);
      expect(pct).toBeLessThan(100);
    });

    it('handles nested objects correctly', () => {
      const data = createEmptyQuestionnaire();
      // Fill all fields in currentAddress
      data.currentAddress = { street: '123 Main', city: 'Springfield', county: 'Greene', zipCode: '65807' };
      const pct = calculateSectionCompletion(data, '1');
      // Should be > 0 since we filled the address fields
      expect(pct).toBeGreaterThan(0);
    });

    it('counts arrays with entries as filled', () => {
      const data = createEmptyQuestionnaire();
      data.unsecuredDebts = [{ creditorName: 'Visa', creditorAddress: '123 St', accountNo: '111', amountOwed: '5000', dateOpened: '2020-01-01' }];
      expect(calculateSectionCompletion(data, '25')).toBe(100);
    });
  });

  describe('calculateStepCompletion', () => {
    it('returns 0 for empty data across multiple sections', () => {
      const data = createEmptyQuestionnaire();
      // Sections 24, 25 have fields defaulting to 'no' or empty arrays
      // Section 25 only has unsecuredDebts (empty array = 0)
      expect(calculateStepCompletion(data, ['25'])).toBe(0);
    });

    it('aggregates across multiple sections', () => {
      const data = createEmptyQuestionnaire();
      data.fullName = 'Jane Doe';
      const step1Pct = calculateStepCompletion(data, ['1', '2']);
      expect(step1Pct).toBeGreaterThan(0);
    });
  });

  describe('getSectionStatus', () => {
    it('returns not-started for empty section', () => {
      const data = createEmptyQuestionnaire();
      expect(getSectionStatus(data, '25')).toBe('not-started');
    });

    it('returns in-progress for partially filled section', () => {
      const data = createEmptyQuestionnaire();
      data.fullName = 'John Doe';
      // Section 1 has many fields, only one is filled
      expect(getSectionStatus(data, '1')).toBe('in-progress');
    });

    it('returns complete for fully filled section', () => {
      const data = createEmptyQuestionnaire();
      data.unsecuredDebts = [{ creditorName: 'X', creditorAddress: 'Y', accountNo: '1', amountOwed: '100', dateOpened: '2020' }];
      expect(getSectionStatus(data, '25')).toBe('complete');
    });
  });

  describe('calculateOverallCompletion', () => {
    it('returns a number between 0 and 100', () => {
      const data = createEmptyQuestionnaire();
      const pct = calculateOverallCompletion(data);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });

    it('increases when fields are filled', () => {
      const data = createEmptyQuestionnaire();
      const before = calculateOverallCompletion(data);
      data.fullName = 'Test User';
      data.ssn = '123-45-6789';
      data.phone = '555-0000';
      const after = calculateOverallCompletion(data);
      expect(after).toBeGreaterThan(before);
    });
  });
});
