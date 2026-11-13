import { WithParams } from '@/components/page';
import NewDraftClient from './new-draft-client';

export const metadata = { title: 'Draft a document' };

export default function Page() {
  return (
    <WithParams>
      <NewDraftClient />
    </WithParams>
  );
}
