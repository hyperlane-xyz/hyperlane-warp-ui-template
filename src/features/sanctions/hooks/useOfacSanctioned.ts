import { useQuery } from '@tanstack/react-query';
import { isAddress, isAddressEqual } from 'viem';

import { useEvmAccount } from '../../wallet/hooks/evm';

const OFAC_SANCTIONED_ADDRESSES_ENDPOINT =
  'https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.json';

export const useOfacSanctioned = () => {
  const evmAddress = useEvmAccount().addresses[0]?.address;

  const sanctionedAddresses = useQuery<string[]>({
    queryKey: ['useOfacSanctioned', evmAddress],
    queryFn: () => fetch(OFAC_SANCTIONED_ADDRESSES_ENDPOINT).then((x) => x.json()),
    enabled: !!evmAddress,
  });

  return (
    !!sanctionedAddresses.data &&
    !!evmAddress &&
    isAddress(evmAddress) &&
    !!sanctionedAddresses.data.find((x) => isAddress(x) && isAddressEqual(x, evmAddress))
  );
};
