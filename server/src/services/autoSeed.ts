import { listForms, createForm } from './db';
import { v4 as uuidv4 } from 'uuid';
import { seedFormData } from '../data/seedData';

export function autoSeed(): void {
  const existing = listForms();
  if (existing.length > 0) {
    return;
  }

  const id = uuidv4();
  createForm(id, 'Robert James Martinez', JSON.stringify(seedFormData));
  console.log(`Auto-seeded sample form: Robert James Martinez (${id})`);
}
