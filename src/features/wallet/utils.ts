import { SendTransactionArgs as ViemTransactionRequest } from '@wagmi/core';
import { PopulatedTransaction as Ethers5Transaction, BigNumber as EthersBN } from 'ethers';

export function ethers5TxToWagmiTx(tx: Ethers5Transaction): ViemTransactionRequest {
  if (!tx.to) throw new Error('No tx recipient address specified');
  if (!tx.data) throw new Error('No tx data specified');
  return {
    to: tx.to,
    value: ethersBnToBigInt(tx.value || EthersBN.from('0')),
    data: tx.data as `0x{string}`,
    nonce: tx.nonce,
    chainId: tx.chainId,
    gas: tx.gasLimit ? ethersBnToBigInt(tx.gasLimit) : undefined,
    gasPrice: tx.gasPrice ? ethersBnToBigInt(tx.gasPrice) : undefined,
    maxFeePerGas: tx.maxFeePerGas ? ethersBnToBigInt(tx.maxFeePerGas) : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas
      ? ethersBnToBigInt(tx.maxPriorityFeePerGas)
      : undefined,
  };
}

function ethersBnToBigInt(bn: EthersBN): bigint {
  return BigInt(bn.toString());
}
