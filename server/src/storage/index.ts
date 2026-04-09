import path from 'path';
import type { IBlobStorage } from './types';
import { LocalFileStorage } from './localFileStorage';

let instance: IBlobStorage | null = null;

/**
 * Returns the active blob storage instance.
 * Currently always LocalFileStorage; swap for Azure/S3 based on env later.
 */
export function getBlobStorage(): IBlobStorage {
  if (!instance) {
    const uploadsDir =
      process.env.BLOB_STORAGE_PATH ||
      path.join(__dirname, '../../data/uploads');
    instance = new LocalFileStorage(uploadsDir);
  }
  return instance;
}

export type { IBlobStorage } from './types';
