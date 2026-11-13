import { WithParams } from '@/components/page';
import AdviserCaseClient from './adviser-case-client';

export const metadata = { title: 'Case review' };

export default function Page() {
  return (
    <WithParams>
      <AdviserCaseClient />
    </WithParams>
  );
}
