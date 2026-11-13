import { WithParams } from '@/components/page';
import DraftClient from './draft-client';

export const metadata = { title: 'Draft a document' };

export default function Page() {
  return (
    <WithParams>
      <DraftClient />
    </WithParams>
  );
}
