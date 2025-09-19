'use client';

import Image from 'next/image';
import { FileUpload } from '@/components/upload/FileUpload';
import type { UploadedFileInfo } from '@/types/analyze';
import { formatFileSize } from '@/lib/utils';

interface UploadPanelProps {
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
  fileInfo: UploadedFileInfo | null;
  error?: string | null;
  onUpload: (file: File) => void;
  onCancel?: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}

export function UploadPanel({
  status,
  progress,
  fileInfo,
  error,
  onUpload,
  onCancel,
  onRetry,
  disabled,
}: UploadPanelProps) {
  const isLoading = status === 'active';
  const showRetry = status === 'error' && Boolean(onRetry);
  const showCancel = isLoading && Boolean(onCancel);

  return (
    <section className="rounded-3xl border border-border-light bg-white p-6 shadow-sm" aria-labelledby="upload-section">
      <header className="flex items-center justify-between">
        <div>
          <h3 id="upload-section" className="text-lg font-semibold text-text-dark">
            Upload Supplement Label
          </h3>
          <p className="text-sm text-text-secondary">
            Supports JPG, PNG, and WebP files (max 10MB).
          </p>
        </div>
        <div className="text-sm font-medium text-text-muted" aria-hidden="true">
          {progress}%
        </div>
      </header>

      <div className="mt-6">
        <FileUpload
          onUpload={onUpload}
          loading={isLoading}
          progress={progress}
          error={error ?? undefined}
          disabled={disabled}
          acceptedTypes={['.jpg', '.jpeg', '.png', '.webp']}
          maxSize={10 * 1024 * 1024}
        />
      </div>

      {fileInfo ? (
        <div className="mt-6 rounded-2xl border border-border-light bg-gray-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-border-muted bg-white">
              {fileInfo.previewUrl ? (
                <Image
                  src={fileInfo.previewUrl}
                  alt={`${fileInfo.response.originalName} preview`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
                  No preview
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1 text-sm" aria-live="polite">
              <p className="font-medium text-text-dark">{fileInfo.response.originalName}</p>
              <p className="text-text-secondary">
                {formatFileSize(fileInfo.response.metadata.size)} · {fileInfo.response.metadata.format.toUpperCase()} · {fileInfo.response.metadata.width}
                ×{fileInfo.response.metadata.height}px
              </p>
              <p className="text-text-muted">
                Uploaded at: {new Date(fileInfo.completedAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {showCancel ? (
          <button
            type="button"
            className="rounded-full border border-border-muted px-4 py-2 text-sm text-text-secondary hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onCancel}
          >
            Cancel upload
          </button>
        ) : null}
        {showRetry ? (
          <button
            type="button"
            className="rounded-full bg-brand-medical px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-medical/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-medical"
            onClick={onRetry}
          >
            Retry upload
          </button>
        ) : null}
      </div>
    </section>
  );
}
