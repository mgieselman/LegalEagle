import fs from 'fs/promises';
import path from 'path';
import type { IBlobStorage } from './types';

/**
 * Local filesystem implementation of IBlobStorage for development.
 * Stores files under a configurable root directory.
 */
export class LocalFileStorage implements IBlobStorage {
  constructor(private readonly rootDir: string) {}

  async upload(filePath: string, data: Buffer, _contentType: string): Promise<string> {
    const fullPath = path.join(this.rootDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.rootDir, filePath);
    return fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.rootDir, filePath);
    await fs.unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.rootDir, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(
    prefix: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ files: string[]; nextCursor: string | null }> {
    const dirPath = path.join(this.rootDir, prefix);
    let entries: string[];
    try {
      entries = await fs.readdir(dirPath);
    } catch {
      return { files: [], nextCursor: null };
    }

    const offset = cursor ? parseInt(cursor, 10) : 0;
    const slice = entries.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    const nextCursor = nextOffset < entries.length ? String(nextOffset) : null;

    return {
      files: slice.map((entry) => path.join(prefix, entry)),
      nextCursor,
    };
  }

  async getSignedUrl(filePath: string, _expiresInSeconds: number): Promise<string> {
    // In local dev, return the API download path — auth middleware handles access control
    return filePath;
  }
}
