import React, { useRef, useState } from 'react';

export interface FileItem {
  file: File;
  previewUrl: string;
}

export interface FileDropProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeBytes?: number; // default 2MB (2 * 1024 * 1024)
  allowedTypes?: string[];
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
}

const DEFAULT_ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const DEFAULT_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const DEFAULT_MAX_FILES = 3;

export const FileDrop: React.FC<FileDropProps> = ({
  files,
  onChange,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED,
  label = 'Photos (Optional)',
  helperText = 'Up to 3 images (JPEG, PNG, WebP), max 2 MB each. EXIF metadata is stripped automatically.',
  error,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (newFiles: FileList | File[]) => {
    setInternalError(null);
    const validList: File[] = [...files];

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];

      if (validList.length >= maxFiles) {
        setInternalError(`Maximum ${maxFiles} photos allowed.`);
        break;
      }

      if (!allowedTypes.includes(file.type)) {
        setInternalError(`File "${file.name}" has invalid format. Only JPEG, PNG, or WebP allowed.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        setInternalError(`File "${file.name}" exceeds 2 MB limit.`);
        continue;
      }

      validList.push(file);
    }

    onChange(validList);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
    }
    // reset input so the same file could be re-selected if removed
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onChange(updated);
    setInternalError(null);
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center">
        {label && (
          <span className="text-xs font-medium uppercase tracking-wider text-[#9aa5a0]">
            {label} ({files.length}/{maxFiles})
          </span>
        )}
      </div>

      {files.length < maxFiles && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Upload photos area. Drag and drop or press Enter to browse files."
          className={`relative border border-dashed rounded-sm p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed border-[rgba(223,231,224,0.1)]' : ''
          } ${
            isDragOver
              ? 'border-[#f5a524] bg-[#f5a524]/5'
              : 'border-[rgba(223,231,224,0.2)] bg-[rgba(10,14,18,0.5)] hover:border-[#f5a524]/60 hover:bg-[rgba(10,14,18,0.8)]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={allowedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <div className="w-10 h-10 mb-2 rounded-full bg-[rgba(223,231,224,0.06)] flex items-center justify-center text-[#9aa5a0]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#dfe7e0]">
            Drop photos here, or <span className="text-[#f5a524] underline underline-offset-2">browse files</span>
          </p>
          <p className="text-xs text-[#9aa5a0] mt-1">JPEG, PNG, WebP up to 2 MB</p>
        </div>
      )}

      {/* Previews */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-1">
          {files.map((file, idx) => {
            const previewUrl = URL.createObjectURL(file);
            return (
              <div
                key={`${file.name}-${idx}`}
                className="relative group border border-[rgba(223,231,224,0.16)] rounded-sm bg-[#0a0e12] overflow-hidden aspect-video flex items-center justify-center"
              >
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onLoad={() => URL.revokeObjectURL(previewUrl)}
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                  <span className="text-[10px] text-[#dfe7e0] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(idx);
                    }}
                    className="self-end p-1 bg-[#ff5a5f] text-black rounded-sm hover:bg-[#e0484d] text-xs font-bold"
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(error || internalError) && (
        <p className="text-xs text-[#ff5a5f]" role="alert">
          {error || internalError}
        </p>
      )}
      {!error && !internalError && helperText && (
        <p className="text-xs text-[#9aa5a0]">{helperText}</p>
      )}
    </div>
  );
};

export default FileDrop;
