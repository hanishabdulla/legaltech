import { WithParams } from '@/components/page';
import ReferralClient from './referral-client';

export const metadata = { title: 'Handoff pack' };

export default function Page() {
  return (
    <WithParams>
      <ReferralClient />
    </WithParams>
  );
}
