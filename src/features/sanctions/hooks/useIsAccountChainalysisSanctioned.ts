import { useEthereumAccount } from '@hyperlane-xyz/widgets';
import { isAddress } from 'viem';
import { useReadContract } from 'wagmi';
import { useMultiProvider } from '../../chains/hooks';

// https://go.chainalysis.com/chainalysis-oracle-docs.html
const ORACLE_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'addr',
        type: 'address',
      },
    ],
    name: 'isSanctioned',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
const ORACLE_ADDRESS = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';

export function useIsAccountChainalysisSanctioned() {
  const multiProvider = useMultiProvider();
  const evmAddress = useEthereumAccount(multiProvider).addresses[0]?.address;

  const sanctioned = useReadContract({
    abi: ORACLE_ABI,
    functionName: 'isSanctioned',
    args: [isAddress(evmAddress) ? evmAddress : '0x'],
    chainId: 1,
    address: ORACLE_ADDRESS,
    query: { enabled: !!evmAddress },
  });

  return !!sanctioned.data;
}
