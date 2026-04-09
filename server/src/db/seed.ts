import { v4 as uuidv4 } from 'uuid';
import type { NewLawFirm, NewUser, NewClient, NewCase, NewQuestionnaire } from './schema';
import { seedFormData } from '../data/seedData';

// Fixed IDs for dev convenience (stable across wipe+reseed)
export const SEED_IDS = {
  lawFirm: 'firm-001',
  adminUser: 'user-admin-001',
  paralegalUser: 'user-paralegal-001',
  attorneyUser: 'user-attorney-001',
  client1: 'client-001',
  client2: 'client-002',
  client3: 'client-003',
  case1: 'case-001',
  case2: 'case-002',
  case3: 'case-003',
  case4: 'case-004',
  questionnaire1: 'quest-001',
  questionnaire2: 'quest-002',
  questionnaire3: 'quest-003',
  questionnaire4: 'quest-004',
} as const;

const now = new Date().toISOString();

export const seedLawFirm: NewLawFirm = {
  id: SEED_IDS.lawFirm,
  name: 'Hartford Legal Associates',
  address: '55 State St, Suite 400, Hartford CT 06103',
  phone: '860-555-0100',
  email: 'info@hartfordlegal.com',
  createdAt: now,
};

export const seedUsers: NewUser[] = [
  {
    id: SEED_IDS.adminUser,
    lawFirmId: SEED_IDS.lawFirm,
    email: 'admin@hartfordlegal.com',
    name: 'Sarah Chen',
    role: 'admin',
    createdAt: now,
  },
  {
    id: SEED_IDS.attorneyUser,
    lawFirmId: SEED_IDS.lawFirm,
    email: 'attorney@hartfordlegal.com',
    name: 'James Wilson',
    role: 'attorney',
    createdAt: now,
  },
  {
    id: SEED_IDS.paralegalUser,
    lawFirmId: SEED_IDS.lawFirm,
    email: 'paralegal@hartfordlegal.com',
    name: 'Maria Lopez',
    role: 'paralegal',
    createdAt: now,
  },
];

export const seedClients: NewClient[] = [
  {
    id: SEED_IDS.client1,
    lawFirmId: SEED_IDS.lawFirm,
    firstName: 'Robert',
    lastName: 'Martinez',
    email: 'rmartinez78@gmail.com',
    phone: '860-555-0147',
    spouseFirstName: 'Linda',
    spouseLastName: 'Martinez',
    createdAt: now,
  },
  {
    id: SEED_IDS.client2,
    lawFirmId: SEED_IDS.lawFirm,
    firstName: 'Angela',
    lastName: 'Thompson',
    email: 'athompson@email.com',
    phone: '860-555-0234',
    createdAt: now,
  },
  {
    id: SEED_IDS.client3,
    lawFirmId: SEED_IDS.lawFirm,
    firstName: 'David',
    lastName: 'Kim',
    email: 'dkim.bk@gmail.com',
    phone: '860-555-0345',
    createdAt: now,
  },
];

export const seedCases: NewCase[] = [
  {
    id: SEED_IDS.case1,
    clientId: SEED_IDS.client1,
    lawFirmId: SEED_IDS.lawFirm,
    chapter: '7',
    status: 'review',
    filingDistrict: 'District of Connecticut',
    isJointFiling: true,
    householdSize: 4,
    createdAt: now,
  },
  {
    id: SEED_IDS.case2,
    clientId: SEED_IDS.client2,
    lawFirmId: SEED_IDS.lawFirm,
    chapter: '7',
    status: 'intake',
    filingDistrict: 'District of Connecticut',
    householdSize: 2,
    createdAt: now,
  },
  {
    id: SEED_IDS.case3,
    clientId: SEED_IDS.client3,
    lawFirmId: SEED_IDS.lawFirm,
    chapter: '13',
    status: 'documents',
    filingDistrict: 'District of Connecticut',
    householdSize: 1,
    createdAt: now,
  },
  {
    id: SEED_IDS.case4,
    clientId: SEED_IDS.client2,
    lawFirmId: SEED_IDS.lawFirm,
    chapter: '7',
    status: 'discharged',
    filingDate: '2024-06-15',
    filingDistrict: 'District of Connecticut',
    householdSize: 2,
    createdAt: now,
  },
];

export const seedQuestionnaires: NewQuestionnaire[] = [
  {
    id: SEED_IDS.questionnaire1,
    caseId: SEED_IDS.case1,
    lawFirmId: SEED_IDS.lawFirm,
    name: 'Robert James Martinez',
    data: JSON.stringify(seedFormData),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.questionnaire2,
    caseId: SEED_IDS.case2,
    lawFirmId: SEED_IDS.lawFirm,
    name: 'Angela Thompson',
    data: JSON.stringify({}),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.questionnaire3,
    caseId: SEED_IDS.case3,
    lawFirmId: SEED_IDS.lawFirm,
    name: 'David Kim',
    data: JSON.stringify({}),
    createdAt: now,
    updatedAt: now,
  },
  {
    id: SEED_IDS.questionnaire4,
    caseId: SEED_IDS.case4,
    lawFirmId: SEED_IDS.lawFirm,
    name: 'Angela Thompson (prior filing)',
    data: JSON.stringify({}),
    createdAt: now,
    updatedAt: now,
  },
];

/**
 * Generate a new unique ID. Used when creating records outside of seed data.
 */
export function generateId(): string {
  return uuidv4();
}
