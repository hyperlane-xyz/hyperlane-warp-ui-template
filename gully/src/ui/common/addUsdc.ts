// "Add Gully Chain + USDC.e": one click, nobody pastes an address (owner 2026-11-01). The same flow and messages as gully-ops
// sites/_shared/gc-add-usdc.js. The logo is Circle's own file; ?v= is its hash, so a wallet that cached the old logo fetches this one.
const RPCS = ['https://testnet-rpc.gullychain.xyz', 'https://rpc.gullyrpc.xyz/gullychain/evm/485590', 'https://rpc2.gullychain.xyz']
export const USDCE = '0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76'
export const CHAIN_PARAMS = { chainId: '0x768d6', chainName: 'Gully Chain Testnet', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: RPCS, blockExplorerUrls: ['https://testnet.gullyscan.xyz'] }
export const TOKEN = { address: USDCE, symbol: 'USDC.e', decimals: 6, image: `https://gullychain.xyz/tokens/logos/485590/${USDCE}.png?v=5b1dbf78` }

export type Say = (kind: 'ok' | 'warn', title: string, body: string) => void
export type Outcome = 'no-wallet' | 'network-rejected' | 'network-failed' | 'added' | 'token-rejected' | 'token-unsupported'
type Eip1193 = { request: (a: { method: string; params?: unknown }) => Promise<unknown> }
const rejected = (e: unknown) => {
  const c = (e as { code?: unknown } | null)?.code
  return c === 4001 || c === 'ACTION_REJECTED'
}

export async function addGullyChainUsdc(eth: Eip1193 | undefined, say: Say): Promise<Outcome> {
  if (!eth || typeof eth.request !== 'function') {
    say('warn', 'No browser wallet found', `Install one, or add chain 485590 and USDC.e ${USDCE} by hand. Gully Wallet needs none of this.`)
    return 'no-wallet'
  }
  let how = 'switched'
  try {
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_PARAMS.chainId }] })
    } catch (e) {
      if (rejected(e)) throw e
      await eth.request({ method: 'wallet_addEthereumChain', params: [CHAIN_PARAMS] }) // 4902, or a wallet that doesn't say why
      how = 'added'
    }
  } catch (e) {
    if (rejected(e)) {
      say('warn', 'Cancelled in your wallet', 'Nothing was added.')
      return 'network-rejected'
    }
    say('warn', 'Your wallet did not add the network', `Add it by hand: chain ID 485590, RPC ${RPCS[0]}.`)
    return 'network-failed'
  }
  say('ok', how === 'added' ? 'Gully Chain Testnet added' : 'On Gully Chain Testnet', 'Now confirm USDC.e in your wallet.')
  try {
    const ok = await eth.request({ method: 'wallet_watchAsset', params: { type: 'ERC20', options: TOKEN } })
    if (ok === false) {
      say('warn', 'USDC.e not added', 'You declined it in your wallet. The network stays added.')
      return 'token-rejected'
    }
    say('ok', 'USDC.e added', 'It shows in your wallet on Gully Chain Testnet.')
    return 'added'
  } catch (e) {
    if (rejected(e)) {
      say('warn', 'USDC.e not added', 'You declined it in your wallet. The network stays added.')
      return 'token-rejected'
    }
    say('warn', 'Your wallet can’t add tokens this way', `Add it by hand: USDC.e ${USDCE}, 6 decimals.`)
    return 'token-unsupported'
  }
}
