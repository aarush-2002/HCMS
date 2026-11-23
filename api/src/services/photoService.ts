import sharp from 'sharp';
import { BadRequestError } from '../middleware/errorHandler.js';
import { defaultStorageService, LocalStorageService } from './storage/LocalStorageService.js';
import { IStorageService } from './storage/IStorageService.js';

export const MAX_PHOTO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

export interface ValidatedPhoto {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  buffer: Buffer;
  sizeBytes: number;
  originalFilename: string;
}

export function detectMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: 'RIFF' .... 'WEBP'
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

export async function processAndValidatePhoto(
  file: Express.Multer.File
): Promise<ValidatedPhoto> {
  if (file.size > MAX_PHOTO_SIZE_BYTES || file.buffer.length > MAX_PHOTO_SIZE_BYTES) {
    throw new BadRequestError(
      `Photo '${file.originalname}' exceeds the maximum allowed size of 2 MB`,
      'PHOTO_TOO_LARGE'
    );
  }

  const detectedMime = detectMagicBytes(file.buffer);
  if (!detectedMime) {
    throw new BadRequestError(
      `Photo '${file.originalname}' has an invalid or unsupported file format. Only true JPEG, PNG, and WebP images are permitted.`,
      'INVALID_PHOTO_TYPE'
    );
  }

  // Strip EXIF metadata and normalize orientation using sharp
  let cleanedBuffer: Buffer;
  try {
    cleanedBuffer = await sharp(file.buffer)
      .rotate() // Auto-rotates based on EXIF before stripping it
      .toBuffer();
  } catch (err) {
    throw new BadRequestError(
      `Failed to process image '${file.originalname}': Corrupt or unreadable image data`,
      'CORRUPT_IMAGE'
    );
  }

  if (cleanedBuffer.length > MAX_PHOTO_SIZE_BYTES) {
    throw new BadRequestError(
      `Processed photo '${file.originalname}' exceeds 2 MB limit`,
      'PHOTO_TOO_LARGE'
    );
  }

  return {
    mimeType: detectedMime,
    buffer: cleanedBuffer,
    sizeBytes: cleanedBuffer.length,
    originalFilename: file.originalname,
  };
}

export class PhotoService {
  private storage: IStorageService;

  constructor(storage: IStorageService = defaultStorageService) {
    this.storage = storage;
  }

  async storePhotos(
    files: Express.Multer.File[]
  ): Promise<Array<{ storageKey: string; filename: string; mimeType: string; sizeBytes: number }>> {
    if (files.length > 3) {
      throw new BadRequestError('Maximum 3 photos can be attached to a complaint', 'TOO_MANY_PHOTOS');
    }

    const savedRecords: Array<{ storageKey: string; filename: string; mimeType: string; sizeBytes: number }> = [];

    for (const file of files) {
      const validated = await processAndValidatePhoto(file);
      const saved = await this.storage.saveFile(
        validated.buffer,
        validated.originalFilename,
        validated.mimeType
      );
      savedRecords.push({
        storageKey: saved.storageKey,
        filename: validated.originalFilename,
        mimeType: validated.mimeType,
        sizeBytes: saved.sizeBytes,
      });
    }

    return savedRecords;
  }

  async cleanupFiles(storageKeys: string[]): Promise<void> {
    for (const key of storageKeys) {
      try {
        await this.storage.deleteFile(key);
      } catch (err) {
        console.warn('Failed to clean up file:', key, err);
      }
    }
  }
}

export const defaultPhotoService = new PhotoService();
