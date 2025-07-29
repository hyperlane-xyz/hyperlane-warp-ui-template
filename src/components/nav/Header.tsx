import Link from 'next/link';
import { ConnectWalletButton } from '../../features/wallet/ConnectWalletButton';

export function Header() {
  return (
    <header className="w-full px-2 pb-2 pt-3 sm:px-6 lg:px-12">
      <div className="flex items-start justify-between">
        <Link href="/" className="flex items-center py-2">
          <span className="text-3xl font-bold text-white transition-colors hover:text-gray-200">
            Pruv Bridge
          </span>
        </Link>
        <div className="flex flex-col items-end gap-2 md:flex-row-reverse md:items-start">
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  );
}
