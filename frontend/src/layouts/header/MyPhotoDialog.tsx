import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/components/auth/Authapi';
import { PhotoPicker } from '@/components/upload/PhotoPicker';
import { NO_PHOTO_CHANGE, isPhotoChanged, resolvePhoto } from '@/components/upload/Uploadapi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateUser } from '@/redux/authSlice';
import { useAppDispatch } from '@/redux/hooks';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import type { UserData } from '@/types';

interface MyPhotoDialogProps {
  user: UserData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyPhotoDialog({ user, open, onOpenChange }: MyPhotoDialogProps) {
  const dispatch = useAppDispatch();
  const [photo, setPhoto] = useState(NO_PHOTO_CHANGE);
  const save = useMutation({
    mutationFn: async () =>
      authApi.updateMyPhoto({ photo: (await resolvePhoto(photo, 'user_photo')) ?? null }),
    onSuccess: (updated) => {
      dispatch(updateUser(updated));
      showToast.success(updated.photo_url ? 'Photo saved' : 'Photo removed');
      onOpenChange(false);
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) setPhoto(NO_PHOTO_CHANGE);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your photo</DialogTitle>
          <DialogDescription>Shown in the header and on the Users page.</DialogDescription>
        </DialogHeader>
        <PhotoPicker
          name={user.name}
          purpose="user_photo"
          currentUrl={user.photo_url}
          value={photo}
          onChange={setPhoto}
          disabled={save.isPending}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!isPhotoChanged(photo) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
