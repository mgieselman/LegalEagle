/**
 * Interface for blob storage — all file storage goes through this abstraction.
 * Implementations: LocalFileStorage (dev), Azure Blob Storage (prod), S3 (alt).
 */
export interface IBlobStorage {
  /** Upload a file. Returns the stored path. */
  upload(path: string, data: Buffer, contentType: string): Promise<string>;

  /** Download a file by path. */
  download(path: string): Promise<Buffer>;

  /** Delete a file by path. */
  delete(path: string): Promise<void>;

  /** Check if a file exists at the given path. */
  exists(path: string): Promise<boolean>;

  /** List files under a prefix, with cursor-based pagination. */
  listFiles(
    prefix: string,
    cursor: string | null,
    limit: number,
  ): Promise<{ files: string[]; nextCursor: string | null }>;

  /** Get a time-limited URL for downloading the file. */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}
