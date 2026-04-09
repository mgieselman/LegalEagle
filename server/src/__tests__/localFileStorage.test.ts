import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { LocalFileStorage } from '../storage/localFileStorage';

let storage: LocalFileStorage;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legaleagle-storage-'));
  storage = new LocalFileStorage(tmpDir);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('LocalFileStorage', () => {
  const testPath = 'firm-1/client-1/case-1/originals/doc-1.pdf';
  const testData = Buffer.from('fake pdf content');

  it('uploads a file and returns the path', async () => {
    const result = await storage.upload(testPath, testData, 'application/pdf');
    expect(result).toBe(testPath);

    const fullPath = path.join(tmpDir, testPath);
    const written = await fs.readFile(fullPath);
    expect(written).toEqual(testData);
  });

  it('downloads a file', async () => {
    const result = await storage.download(testPath);
    expect(result).toEqual(testData);
  });

  it('checks existence of a file', async () => {
    expect(await storage.exists(testPath)).toBe(true);
    expect(await storage.exists('nonexistent/file.pdf')).toBe(false);
  });

  it('lists files under a prefix', async () => {
    // Upload a second file in the same directory
    const secondPath = 'firm-1/client-1/case-1/originals/doc-2.pdf';
    await storage.upload(secondPath, Buffer.from('second'), 'application/pdf');

    const result = await storage.listFiles(
      'firm-1/client-1/case-1/originals',
      null,
      10,
    );
    expect(result.files).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('paginates listFiles with cursor', async () => {
    const result = await storage.listFiles(
      'firm-1/client-1/case-1/originals',
      null,
      1,
    );
    expect(result.files).toHaveLength(1);
    expect(result.nextCursor).toBe('1');

    const page2 = await storage.listFiles(
      'firm-1/client-1/case-1/originals',
      result.nextCursor,
      1,
    );
    expect(page2.files).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
  });

  it('returns empty list for nonexistent prefix', async () => {
    const result = await storage.listFiles('no-such-dir', null, 10);
    expect(result.files).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it('deletes a file', async () => {
    await storage.delete(testPath);
    expect(await storage.exists(testPath)).toBe(false);
  });

  it('delete is idempotent for missing files', async () => {
    await expect(storage.delete('nonexistent.pdf')).resolves.toBeUndefined();
  });

  it('getSignedUrl returns the path in local dev', async () => {
    const url = await storage.getSignedUrl('some/path.pdf', 300);
    expect(url).toBe('some/path.pdf');
  });
});
