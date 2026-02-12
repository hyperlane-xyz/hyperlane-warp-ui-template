import { shortenAddress } from '@hyperlane-xyz/utils';
import { CopyButton } from '@hyperlane-xyz/widgets';
import { useIcaBalance } from '../hooks/useIcaBalance';
import { getSwapConfig } from '../swapConfig';

interface IcaBalanceDisplayProps {
  icaAddress: string | null;
  chainName: string;
  destinationChainName: string;
  isIcaAddressLoading?: boolean;
  canResolveAddress?: boolean;
}

export function IcaBalanceDisplay({
  icaAddress,
  chainName,
  destinationChainName,
  isIcaAddressLoading = false,
  canResolveAddress = false,
}: IcaBalanceDisplayProps) {
  const destConfig = getSwapConfig(destinationChainName);
  const { data, isLoading } = useIcaBalance(
    icaAddress,
    destConfig?.chainId ?? 0,
    destinationChainName,
  );
  const addressLabel = icaAddress
    ? shortenAddress(icaAddress)
    : isIcaAddressLoading
      ? 'Resolving...'
      : canResolveAddress
        ? 'Unavailable'
        : 'Connect wallet to resolve';

  return (
    <div className="rounded border border-gray-300 bg-gray-150 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-700">{chainName} ICA address</div>
          <div className="mt-0.5 truncate font-primary text-xs text-gray-900">{addressLabel}</div>
        </div>
        {icaAddress ? (
          <CopyButton copyValue={icaAddress} width={14} height={14} className="opacity-40" />
        ) : null}
      </div>

      <div className="mt-2 text-xs text-gray-700">Balances</div>
      {isLoading ? (
        <div className="mt-1 text-xs text-gray-500">Loading...</div>
      ) : (
        <div className="mt-1 space-y-1">
          {(data?.tokens || []).map((token) => (
            <div
              key={token.symbol}
              className="flex items-center justify-between text-xs text-gray-900"
            >
              <span>{token.symbol}</span>
              <span>{token.balance}</span>
            </div>
          ))}
        </div>
      )}
      {!isLoading && !(data?.tokens?.length ?? 0) ? (
        <div className="mt-1 text-xs text-gray-500">No token balances yet.</div>
      ) : null}
    </div>
  );
}
