import { WithParams } from '@/components/page';
import MatterClient from './matter-client';

export const metadata = { title: 'Your answer' };

export default function Page() {
  return (
    <WithParams>
      <MatterClient />
    </WithParams>
  );
}
