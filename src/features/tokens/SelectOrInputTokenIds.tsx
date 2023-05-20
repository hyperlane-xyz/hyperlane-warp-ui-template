import { useFormikContext } from 'formik';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

import { TextField } from '../../components/input/TextField';
import { TransferFormValues } from '../transfer/types';

import { SelectTokenIdField } from './SelectTokenIdField';
import { isContractHaveTokenOfOwnerByIndex } from './useTokenBalance';

export default function SelectOrInputTokenIds() {
  const { address } = useAccount();
  const {
    values: { originChainId, tokenAddress },
  } = useFormikContext<TransferFormValues>();

  const [isContractAllowToGetTokenIds, setIsContractAllowToGetTokenIds] = useState(false);

  useEffect(() => {
    const checkTokenIds = async (chainId: ChainId, tokenAddress: Address, address: Address) => {
      const isAllow = await isContractHaveTokenOfOwnerByIndex(chainId, tokenAddress, address);
      setIsContractAllowToGetTokenIds(isAllow);
    };

    if (address) checkTokenIds(originChainId, tokenAddress, address);
  }, [originChainId, tokenAddress, address]);

  return isContractAllowToGetTokenIds ? (
    <SelectTokenIdField name="amount" chainId={originChainId} tokenAddress={tokenAddress} />
  ) : (
    <div className="relative w-full">
      <TextField
        name="amount"
        placeholder="Input Token Id"
        classes="w-full"
        type="number"
        step="any"
      />
    </div>
  );
}
