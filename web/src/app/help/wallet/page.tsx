import { WithParams } from '@/components/page';
import WalletClient from './wallet-client';

export const metadata = { title: 'Wallet' };

export default function Page() {
  return (
    <WithParams>
      <WalletClient />
    </WithParams>
  );
}
