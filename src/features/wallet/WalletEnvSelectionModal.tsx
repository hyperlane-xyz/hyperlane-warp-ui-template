import Image from 'next/image';
import { PropsWithChildren } from 'react';

import { chainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { ChainLogo } from '@hyperlane-xyz/widgets';

import { Modal } from '../../components/layout/Modal';

import { useConnectFns } from './hooks';

export function WalletEnvSelectionModal({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const connectFns = useConnectFns();

  const onClickEnv = (env: ProtocolType) => () => {
    close();
    const connectFn = connectFns[env];
    if (connectFn) connectFn();
  };

  return (
    <Modal title="Select Wallet Environment" isOpen={isOpen} close={close} width="max-w-sm">
      <div className="pt-4 pb-2 flex flex-col space-y-2.5">
        <EnvButton
          onClick={onClickEnv(ProtocolType.Ethereum)}
          subTitle="an EVM"
          logoChainId={chainMetadata.ethereum.chainId}
        >
          Ethereum
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          logoChainId={chainMetadata.solanadevnet.chainId}
        >
          Solana
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Cosmos)}
          subTitle="a Cosmos"
          logo={<Image src={'/logos/cosmos.svg'} width={34} height={34} alt="" />}
        >
          Cosmos
        </EnvButton>
      </div>
    </Modal>
  );
}

function EnvButton({
  onClick,
  subTitle,
  logo,
  logoChainId,
  children,
}: PropsWithChildren<{
  subTitle: string;
  logoChainId?: number;
  logo?: React.ReactElement;
  onClick?: () => void;
}>) {
  if (!logo && !logoChainId) throw new Error('Either logo or logoChainId must be provided');
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 space-y-2.5 flex flex-col items-center rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-200 active:bg-gray-200 transition-all"
    >
      {logo || <ChainLogo chainId={logoChainId} size={34} />}
      <div className="uppercase text-gray-800 tracking-wide">{children}</div>
      <div className="text-sm text-gray-500">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
