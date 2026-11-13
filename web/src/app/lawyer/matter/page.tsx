import { WithParams } from '@/components/page';
import LawyerMatterClient from './lawyer-matter-client';

export const metadata = { title: 'Matter review' };

export default function Page() {
  return (
    <WithParams>
      <LawyerMatterClient />
    </WithParams>
  );
}
