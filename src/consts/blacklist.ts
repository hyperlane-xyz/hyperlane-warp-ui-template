// A list of addresses that are cannot be used in the app
// If a wallet with this address is connected, the app will show an error
export const ADDRESS_BLACKLIST: string[] = [];

// Well-known addresses that should never be used as transfer recipients
// These are common mistake addresses, burn addresses, or precompile addresses
// Keys should be lowercase for case-insensitive comparison
export const BLOCKED_RECIPIENT_ADDRESSES: Record<string, string> = {
  // Null/Zero addresses
  '0x0000000000000000000000000000000000000000': 'Null address (0x0)',
  '0x0000000000000000000000000000000000000001': 'Precompile address',
  '0x0000000000000000000000000000000000000002': 'Precompile address',
  '0x0000000000000000000000000000000000000003': 'Precompile address',
  '0x0000000000000000000000000000000000000004': 'Precompile address',
  '0x0000000000000000000000000000000000000005': 'Precompile address',
  '0x0000000000000000000000000000000000000006': 'Precompile address',
  '0x0000000000000000000000000000000000000007': 'Precompile address',
  '0x0000000000000000000000000000000000000008': 'Precompile address',
  '0x0000000000000000000000000000000000000009': 'Precompile address',
  // Common burn addresses
  '0x000000000000000000000000000000000000dead': 'Burn address',
  '0xdead000000000000000000000000000000000000': 'Burn address',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 'Native token placeholder address',
};
