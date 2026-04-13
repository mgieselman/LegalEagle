import type { LucideIcon } from 'lucide-react';
import {
  User, FileText,
  CheckCircle, Search, Calculator, FileCheck, Send,
} from 'lucide-react';

export interface SidebarSection {
  key: string;
  label: string;
  sectionKeys: string[]; // questionnaire section keys for completion calc
  group?: string;        // visual group header in sidebar
}

export interface StepConfig {
  key: string;           // URL segment
  label: string;         // Display label
  icon: LucideIcon;
  /** Questionnaire section keys this step covers (for completion calculation) */
  sectionKeys?: string[];
  /** Expandable sub-items in the sidebar */
  sections?: SidebarSection[];
  /** What drives the completion indicator */
  completionSource: 'questionnaire' | 'documents' | 'case-status' | 'none';
}

/** All 27 questionnaire sections listed individually with group labels. */
const ALL_QUESTIONNAIRE_SECTIONS: SidebarSection[] = [
  // Personal Info
  { key: '1', label: 'Name & Residence', sectionKeys: ['1'], group: 'Personal Info' },
  { key: '2', label: 'Prior Bankruptcy', sectionKeys: ['2'], group: 'Personal Info' },
  // Income & Employment
  { key: '3', label: 'Occupation & Income', sectionKeys: ['3'], group: 'Income & Employment' },
  { key: '4', label: 'Business & Employment', sectionKeys: ['4'], group: 'Income & Employment' },
  { key: '5', label: 'Financial Questions', sectionKeys: ['5'], group: 'Income & Employment' },
  { key: '6', label: 'Taxes', sectionKeys: ['6'], group: 'Income & Employment' },
  // Debts & Liabilities
  { key: '7', label: 'Debts Repaid', sectionKeys: ['7'], group: 'Debts & Liabilities' },
  { key: '8', label: 'Suits', sectionKeys: ['8'], group: 'Debts & Liabilities' },
  { key: '9', label: 'Garnishment', sectionKeys: ['9'], group: 'Debts & Liabilities' },
  { key: '10', label: 'Repossessions', sectionKeys: ['10'], group: 'Debts & Liabilities' },
  { key: '21', label: 'Cosigners', sectionKeys: ['21'], group: 'Debts & Liabilities' },
  { key: '22', label: 'Credit Cards', sectionKeys: ['22'], group: 'Debts & Liabilities' },
  { key: '23', label: 'Evictions', sectionKeys: ['23'], group: 'Debts & Liabilities' },
  { key: '24', label: 'Secured Debts', sectionKeys: ['24'], group: 'Debts & Liabilities' },
  { key: '25', label: 'Unsecured Debts', sectionKeys: ['25'], group: 'Debts & Liabilities' },
  // Assets & Property
  { key: '11', label: 'Property Held by Others', sectionKeys: ['11'], group: 'Assets & Property' },
  { key: '12', label: 'Gifts & Transfers', sectionKeys: ['12'], group: 'Assets & Property' },
  { key: '13', label: 'Losses', sectionKeys: ['13'], group: 'Assets & Property' },
  { key: '14', label: 'Attorneys & Consultants', sectionKeys: ['14'], group: 'Assets & Property' },
  { key: '15', label: 'Closed Bank Accounts', sectionKeys: ['15'], group: 'Assets & Property' },
  { key: '16', label: 'Safe Deposit Boxes', sectionKeys: ['16'], group: 'Assets & Property' },
  { key: '17', label: 'Property for Others', sectionKeys: ['17'], group: 'Assets & Property' },
  { key: '18', label: 'Leases & Cooperatives', sectionKeys: ['18'], group: 'Assets & Property' },
  { key: '19', label: 'Alimony & Support', sectionKeys: ['19'], group: 'Assets & Property' },
  { key: '20', label: 'Accidents', sectionKeys: ['20'], group: 'Assets & Property' },
  { key: '26', label: 'Asset Listing', sectionKeys: ['26'], group: 'Assets & Property' },
  { key: '27', label: 'Vehicles', sectionKeys: ['27'], group: 'Assets & Property' },
];

const ALL_SECTION_KEYS = ALL_QUESTIONNAIRE_SECTIONS.map((s) => s.sectionKeys[0]);

/**
 * Client steps (3) — intake journey:
 * Questionnaire → Documents → Review
 */
export const CLIENT_STEPS: StepConfig[] = [
  {
    key: 'documents',
    label: 'Documents',
    icon: FileText,
    completionSource: 'documents',
  },
  {
    key: 'questionnaire',
    label: 'Questionnaire',
    icon: User,
    completionSource: 'questionnaire',
    sectionKeys: ALL_SECTION_KEYS,
    sections: ALL_QUESTIONNAIRE_SECTIONS,
  },
  {
    key: 'review',
    label: 'Review',
    icon: CheckCircle,
    completionSource: 'none',
  },
];

/**
 * Staff steps (7) — case lifecycle:
 * Intake → Documents → Extraction → Means Test → Review → Petition → Filing
 */
export const STAFF_STEPS: StepConfig[] = [
  {
    key: 'intake',
    label: 'Intake',
    icon: User,
    completionSource: 'questionnaire',
    sectionKeys: ALL_SECTION_KEYS,
    sections: ALL_QUESTIONNAIRE_SECTIONS,
  },
  {
    key: 'documents',
    label: 'Documents',
    icon: FileText,
    completionSource: 'documents',
  },
  {
    key: 'extraction',
    label: 'Extraction',
    icon: Search,
    completionSource: 'case-status',
  },
  {
    key: 'means-test',
    label: 'Means Test',
    icon: Calculator,
    completionSource: 'case-status',
  },
  {
    key: 'review',
    label: 'Review',
    icon: CheckCircle,
    completionSource: 'case-status',
  },
  {
    key: 'petition',
    label: 'Petition',
    icon: FileCheck,
    completionSource: 'case-status',
  },
  {
    key: 'filing',
    label: 'Filing',
    icon: Send,
    completionSource: 'case-status',
  },
];

/** Group definitions for review/progress display. */
export const QUESTIONNAIRE_GROUPS = [
  { label: 'Personal Info', sectionKeys: ['1', '2'] },
  { label: 'Income & Employment', sectionKeys: ['3', '4', '5', '6'] },
  { label: 'Debts & Liabilities', sectionKeys: ['7', '8', '9', '10', '21', '22', '23', '24', '25'] },
  { label: 'Assets & Property', sectionKeys: ['11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '26', '27'] },
];

export function getStepByKey(steps: StepConfig[], key: string): StepConfig | undefined {
  return steps.find((s) => s.key === key);
}
