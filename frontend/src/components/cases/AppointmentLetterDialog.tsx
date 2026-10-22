import { useState, type ReactNode } from 'react';
import { FilePicker } from '@/components/upload/FilePicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFileUpload } from '@/hooks/useFileUpload';
import { UploadPurpose } from '@/types';
import { casesApi } from './Casesapi';
import { useCaseMutation } from './useCaseMutation';

export function AppointmentLetterDialog({ caseId, trigger }: { caseId: string; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const upload = useFileUpload(UploadPurpose.APPOINTMENT_LETTER);
  const attach = useCaseMutation(
    caseId,
    async (picked: File) => casesApi.uploadAppointmentLetter(caseId, await upload.mutateAsync(picked)),
    {
      onSuccess: () => {
        setOpen(false);
        setFile(null);
      },
    },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Appointment letter</DialogTitle>
          <DialogDescription>
            It rides along on the welcome email and is never opened by the agent. A new upload replaces the old one.
          </DialogDescription>
        </DialogHeader>
        <FilePicker purpose={UploadPurpose.APPOINTMENT_LETTER} file={file} onChange={setFile} uploading={upload.isPending} label="PDF letter" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!file || attach.isPending} onClick={() => file && attach.mutate(file)}>
            {attach.isPending ? 'Uploading…' : 'Attach letter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
