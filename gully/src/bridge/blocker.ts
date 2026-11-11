// Why the Send button is off, in the words it shows. Pure: unit-tested in caps.test.ts. An over-cap or unpayable quote
// comes back unavailable (localClient quote), so `quote.reason` is what stops the transfer in the UI.
import type { Quote } from './types';

export interface BlockerInput {
  amount: bigint | null | undefined;
  quote: Quote | null | undefined;
  quoting: boolean;
  wallet: string | null | undefined;
  /** what the wallet holds of the send token; undefined = not read yet */
  balanceFrom: bigint | undefined;
  /** the quote's value (amount + relay gas) is paid out of balanceFrom */
  paysValueFromBalance: boolean;
}

export function sendBlocker({ amount, quote, quoting, wallet, balanceFrom, paysValueFromBalance }: BlockerInput): string | undefined {
  if (!amount || amount <= 0n) return 'Enter an amount';
  if (!quote) return quoting ? 'Getting a quote' : 'No quote';
  if (wallet && balanceFrom !== undefined && amount > balanceFrom) return `Insufficient ${quote.sendSymbol} balance`;
  if (!quote.available) return quote.reason || 'Route unavailable';
  if (wallet && balanceFrom !== undefined && quote.value > 0n && paysValueFromBalance && balanceFrom < quote.value) return 'Insufficient balance';
  return undefined;
}
