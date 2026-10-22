import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalKeys } from '@/components/approvals/Approvalsapi';
import { exitKeys } from '@/components/exits/Exitsapi';
import { joinerKeys } from '@/components/joiners/Joinersapi';
import { getErrorMessage } from '@/utils/apiError';
import { showToast } from '@/utils/toast';
import { caseKeys } from './Casesapi';

interface CaseMutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: unknown) => boolean | void;
}

export function useCaseMutation<TVariables, TData extends { message: string }>(
  caseId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: CaseMutationOptions<TData> = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) });
      queryClient.invalidateQueries({ queryKey: joinerKeys.all });
      queryClient.invalidateQueries({ queryKey: exitKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      showToast.success(data.message);
      options.onSuccess?.(data);
    },
    onError: (error) => {
      if (!options.onError?.(error)) showToast.error(getErrorMessage(error));
    },
  });
}
