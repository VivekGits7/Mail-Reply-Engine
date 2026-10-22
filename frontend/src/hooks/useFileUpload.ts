import { useMutation } from '@tanstack/react-query';
import { uploadFile } from '@/components/upload/Uploadapi';
import { setUploadProgress } from '@/redux/commonSlice';
import { useAppDispatch } from '@/redux/hooks';
import type { UploadPurpose } from '@/types';

export function useFileUpload(purpose: UploadPurpose) {
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: (file: File) => uploadFile(file, purpose, (percent) => dispatch(setUploadProgress(percent))),
    onSettled: () => dispatch(setUploadProgress(0)),
  });
}
