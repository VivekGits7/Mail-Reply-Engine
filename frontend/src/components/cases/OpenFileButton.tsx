import { useMutation } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';

interface OpenFileButtonProps {
  getUrl: () => Promise<{ url: string }>;
  label?: string;
}

export function OpenFileButton({ getUrl, label = 'Open' }: OpenFileButtonProps) {
  const open = useMutation({
    mutationFn: async () => {
      // Open the tab inside the click so popup blockers allow it, then point it at the short lived link.
      const tab = window.open('about:blank', '_blank');
      try {
        const { url } = await getUrl();
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          window.location.assign(url);
        }
      } catch (error) {
        tab?.close();
        throw error;
      }
    },
    onError: (error) => showToast.error(getErrorMessage(error)),
  });

  return (
    <Button variant="ghost" size="sm" onClick={() => open.mutate()} disabled={open.isPending}>
      <ExternalLink aria-hidden="true" />
      {label}
    </Button>
  );
}
