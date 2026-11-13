import { WithParams } from '@/components/page';
import CaseClient from './case-client';

export const metadata = { title: 'Your case' };

export default function Page() {
  return (
    <WithParams>
      <CaseClient />
    </WithParams>
  );
}
