import { WithParams } from '@/components/page';
import PlanClient from './plan-client';

export const metadata = { title: 'Action plan' };

export default function Page() {
  return (
    <WithParams>
      <PlanClient />
    </WithParams>
  );
}
