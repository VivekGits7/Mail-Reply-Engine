import { useId } from 'react';
import { FileUp, X } from 'lucide-react';
import { useAppSelector } from '@/redux/hooks';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/utility';
import type { UploadPurpose } from '@/types';
import { ACCEPT_BY_PURPOSE } from './Uploadapi';

interface FilePickerProps {
  purpose: UploadPurpose;
  file: File | null;
  onChange: (file: File | null) => void;
  uploading?: boolean;
  label?: string;
}

export function FilePicker({ purpose, file, onChange, uploading, label = 'File' }: FilePickerProps) {
  const id = useId();
  const progress = useAppSelector((state) => state.common.uploadProgress);
  const accept = ACCEPT_BY_PURPOSE[purpose];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
          <FileUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {uploading ? `Uploading ${progress}%` : formatBytes(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove file"
            disabled={uploading}
            onClick={() => onChange(null)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-dashed px-3 py-4 text-sm transition-colors hover:bg-muted/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <span className="font-medium">Choose a file</span>
          <span className="text-xs text-muted-foreground">Allowed: {accept.replaceAll('.', '').replaceAll(',', ', ')}</span>
          <input
            id={id}
            type="file"
            accept={accept}
            aria-labelledby={`${id}-label`}
            className="sr-only"
            onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          />
        </label>
      )}
    </div>
  );
}
