import { WithParams } from '@/components/page';
import StepsClient from './steps-client';

export const metadata = { title: 'Step by step' };

export default function Page() {
  return (
    <WithParams>
      <StepsClient />
    </WithParams>
  );
}
