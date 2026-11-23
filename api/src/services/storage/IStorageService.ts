import { Readable } from 'stream';

export interface SavedFile {
  storageKey: string;
  sizeBytes: number;
}

export interface StoredFileStream {
  stream: Readable;
  sizeBytes: number;
  mimeType?: string;
}

export interface IStorageService {
  saveFile(buffer: Buffer, originalFilename: string, mimeType: string): Promise<SavedFile>;
  getFileStream(storageKey: string): Promise<StoredFileStream | null>;
  deleteFile(storageKey: string): Promise<void>;
}
