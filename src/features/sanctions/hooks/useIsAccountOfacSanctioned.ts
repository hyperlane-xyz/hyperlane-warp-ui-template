import { useQuery } from '@tanstack/react-query';

import { eqAddress } from '@hyperlane-xyz/utils';

import { useEvmAccount } from '../../wallet/hooks/evm';

const OFAC_SANCTIONED_ADDRESSES_ENDPOINT =
  'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.json';

export function useIsAccountOfacSanctioned() {
  const evmAddress = useEvmAccount().addresses[0]?.address;

  const sanctionedAddresses = useQuery<string[]>({
    queryKey: ['useIsAccountOfacSanctioned', evmAddress],
    queryFn: () => fetch(OFAC_SANCTIONED_ADDRESSES_ENDPOINT).then((x) => x.json()),
    enabled: !!evmAddress,
  });

  return (
    !!sanctionedAddresses.data &&
    !!evmAddress &&
    !!sanctionedAddresses.data.find((x) => eqAddress(x, evmAddress))
  );
}
