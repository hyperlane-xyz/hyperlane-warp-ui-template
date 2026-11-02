import { describe, expect, it } from 'vitest'
import { addGullyChainUsdc, TOKEN } from '../src/ui/common/addUsdc'

const rej = () => Object.assign(new Error('no'), { code: 4001 })
function wallet(over: Record<string, () => unknown> = {}) {
  const calls: string[] = []
  return { calls, request: async ({ method }: { method: string }) => { calls.push(method); if (over[method]) return over[method](); return method === 'wallet_watchAsset' ? true : null } }
}
const run = async (eth: Parameters<typeof addGullyChainUsdc>[0]) => { const said: string[] = []; const r = await addGullyChainUsdc(eth, (_k, t) => said.push(t)); return { r, said } }

describe('Add Gully Chain + USDC.e', () => {
  it('adds an unknown chain, then watches USDC.e with the Circle logo', async () => {
    const eth = wallet({ wallet_switchEthereumChain: () => { throw Object.assign(new Error('x'), { code: 4902 }) } })
    const { r, said } = await run(eth)
    expect(r).toBe('added')
    expect(eth.calls).toEqual(['wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_watchAsset'])
    expect(said).toEqual(['Gully Chain Testnet added', 'USDC.e added'])
    expect([TOKEN.symbol, TOKEN.decimals]).toEqual(['USDC.e', 6])
    expect(TOKEN.image).toMatch(/0x65Ba03c6FA90Ed549f465D4c8f2e784D6eEB7E76\.png\?v=5b1dbf78$/)
  })
  it('switches when the chain is known', async () => {
    const eth = wallet()
    expect((await run(eth)).r).toBe('added')
    expect(eth.calls).toEqual(['wallet_switchEthereumChain', 'wallet_watchAsset'])
  })
  it('says what happened when there is no wallet, or the user or the wallet says no', async () => {
    expect((await run(undefined)).r).toBe('no-wallet')
    const a = wallet({ wallet_switchEthereumChain: () => { throw rej() } })
    expect((await run(a)).r).toBe('network-rejected')
    expect(a.calls).toEqual(['wallet_switchEthereumChain'])
    expect((await run(wallet({ wallet_switchEthereumChain: () => { throw new Error('x') }, wallet_addEthereumChain: () => { throw new Error('y') } }))).r).toBe('network-failed')
    expect((await run(wallet({ wallet_watchAsset: () => { throw rej() } }))).r).toBe('token-rejected')
    expect((await run(wallet({ wallet_watchAsset: () => false }))).r).toBe('token-rejected')
    expect((await run(wallet({ wallet_watchAsset: () => { throw new Error('unsupported') } }))).r).toBe('token-unsupported')
  })
})
