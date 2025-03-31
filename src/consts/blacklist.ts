// A list of addresses that are cannot be used in the app
// If a wallet with this address is connected, the app will show an error
export const ADDRESS_BLACKLIST: string[] = [];

// A list of chains to be filtered out from the chainmetadata
export const EXCLUDED_CHAINS: ChainName[] = ['ink', 'worldchain'];
