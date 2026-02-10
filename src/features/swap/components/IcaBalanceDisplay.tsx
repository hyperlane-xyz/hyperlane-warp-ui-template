import { shortenAddress } from '@hyperlane-xyz/utils';
import { CopyButton } from '@hyperlane-xyz/widgets';
import { useIcaBalance } from '../hooks/useIcaBalance';
import { getSwapConfig } from '../swapConfig';

interface IcaBalanceDisplayProps {
  icaAddress: string | null;
  chainName: string;
  destinationChainName: string;
}

export function IcaBalanceDisplay({
  icaAddress,
  chainName,
  destinationChainName,
}: IcaBalanceDisplayProps) {
  const destConfig = getSwapConfig(destinationChainName);
  const { data, isLoading } = useIcaBalance(
    icaAddress,
    destConfig?.chainId ?? 0,
    destinationChainName,
  );

  return (
    <div className="rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
      <h4 className="font-secondary text-sm text-gray-900">Your {chainName} Account</h4>

      <div className="mt-2 rounded border border-gray-300 bg-gray-150 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs text-gray-700">
          <span>ICA address</span>
          {icaAddress ? (
            <CopyButton copyValue={icaAddress} width={14} height={14} className="opacity-40" />
          ) : null}
        </div>
        <div className="font-mono mt-1 truncate text-xs text-gray-900">
          {icaAddress ? shortenAddress(icaAddress) : 'Unavailable'}
        </div>
      </div>

      <div className="mt-2 rounded border border-gray-300 bg-gray-150 px-3 py-2">
        <div className="text-xs text-gray-700">Balances</div>
        {isLoading ? (
          <div className="mt-2 text-sm text-gray-500">Loading balances...</div>
        ) : (
          <div className="mt-2 space-y-1.5">
            {(data?.tokens || []).map((token) => (
              <div
                key={token.symbol}
                className="flex items-center justify-between text-sm text-gray-900"
              >
                <span>{token.symbol}</span>
                <span>{token.balance}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
