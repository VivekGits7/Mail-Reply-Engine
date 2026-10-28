import { useEffect, useId, useMemo, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/visual/Avatar';
import { Button } from '@/components/ui/button';
import {
  ACCEPT_BY_PURPOSE,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  mimeTypeOf,
  type PhotoChange,
  type PhotoPurpose,
} from './Uploadapi';

interface PhotoPickerProps {
  name: string;
  purpose: PhotoPurpose;
  currentUrl?: string | null;
  value: PhotoChange;
  onChange: (value: PhotoChange) => void;
  disabled?: boolean;
  label?: string;
}

export function PhotoPicker({
  name,
  purpose,
  currentUrl,
  value,
  onChange,
  disabled,
  label = 'Photo',
}: PhotoPickerProps) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useMemo(() => (value.file ? URL.createObjectURL(value.file) : null), [value.file]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const shown = previewUrl ?? (value.removed ? null : currentUrl);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.has(mimeTypeOf(file))) {
      setError('Use a JPG, PNG or WEBP image');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setError('Photo is too large, the limit is 5 MB');
      return;
    }
    setError(null);
    onChange({ file, removed: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium" id={`${id}-label`}>
        {label}
      </span>
      <div className="flex items-center gap-4">
        <Avatar name={name.trim() || 'New'} src={shown} size="xl" />
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor={id}
            aria-disabled={disabled}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors hover:bg-muted/60 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <Camera className="size-4" aria-hidden="true" />
            {shown ? 'Change photo' : 'Add photo'}
            <input
              id={id}
              type="file"
              accept={ACCEPT_BY_PURPOSE[purpose]}
              aria-labelledby={`${id}-label`}
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                pick(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </label>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setError(null);
                onChange({ file: null, removed: Boolean(currentUrl) });
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">JPG, PNG or WEBP, up to 5 MB</p>
      )}
    </div>
  );
}
