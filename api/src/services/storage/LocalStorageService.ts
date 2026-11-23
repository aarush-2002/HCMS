import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IStorageService, SavedFile, StoredFileStream } from './IStorageService.js';

export class LocalStorageService implements IStorageService {
  private baseDir: string;

  constructor(customDir?: string) {
    this.baseDir = customDir || path.resolve(process.cwd(), 'uploads', 'complaints_secure');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalFilename: string, mimeType: string): Promise<SavedFile> {
    const ext = path.extname(originalFilename) || this.getExtensionFromMime(mimeType);
    const randomName = `${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(this.baseDir, randomName);

    await fs.promises.writeFile(fullPath, buffer);

    return {
      storageKey: randomName,
      sizeBytes: buffer.length,
    };
  }

  async getFileStream(storageKey: string): Promise<StoredFileStream | null> {
    // Prevent path traversal
    const safeKey = path.basename(storageKey);
    const fullPath = path.join(this.baseDir, safeKey);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const stat = await fs.promises.stat(fullPath);
    const stream = fs.createReadStream(fullPath);

    return {
      stream,
      sizeBytes: stat.size,
    };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const safeKey = path.basename(storageKey);
    const fullPath = path.join(this.baseDir, safeKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }

  private getExtensionFromMime(mime: string): string {
    switch (mime.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return '.bin';
    }
  }
}

export const defaultStorageService = new LocalStorageService();
