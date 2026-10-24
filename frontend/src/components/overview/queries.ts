import { joinerListQuery } from '@/components/joiners/Joinersapi';
import type { OnboardingStage } from '@/types';

export function stageCountQuery(stage: OnboardingStage) {
  return joinerListQuery({ stage, status: 'open', limit: 1, offset: 0 });
}
