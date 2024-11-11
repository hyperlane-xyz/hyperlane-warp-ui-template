import { TokenAmount } from '@hyperlane-xyz/sdk';
import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

export function useRecipientBalanceWatcher(recipient?: Address, balance?: TokenAmount) {
  // A crude way to detect transfer completions by triggering
  // toast on recipient balance increase. This is not ideal because it
  // could confuse unrelated balance changes for message delivery
  // TODO replace with a polling worker that queries the hyperlane explorer
  const prevRecipientBalance = useRef<{ balance?: TokenAmount; recipient?: string }>({
    recipient: '',
  });
  useEffect(() => {
    if (
      recipient &&
      balance &&
      prevRecipientBalance.current.balance &&
      prevRecipientBalance.current.recipient === recipient &&
      balance.token.equals(prevRecipientBalance.current.balance.token) &&
      balance.amount > prevRecipientBalance.current.balance.amount
    ) {
      toast.success('Recipient has received funds, transfer complete!');
    }
    prevRecipientBalance.current = { balance, recipient: recipient };
  }, [balance, recipient, prevRecipientBalance]);
}
