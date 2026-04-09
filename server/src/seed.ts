import './env';
import { createForm, listForms } from './services/db';
import { v4 as uuidv4 } from 'uuid';
import { seedFormData } from './data/seedData';

const DEFAULT_FIRM_ID = 'firm-001';
const existing = listForms(DEFAULT_FIRM_ID);
if (existing.length > 0) {
  console.log(`Database already has ${existing.length} form(s). Skipping seed.`);
  console.log('To re-seed, delete the database file first.');
} else {
  const id = uuidv4();
  createForm(id, 'Robert James Martinez', JSON.stringify(seedFormData), DEFAULT_FIRM_ID);
  console.log(`Seeded form: ${id} (Robert James Martinez)`);
}

process.exit(0);
