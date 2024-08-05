import Image from 'next/image';
import { PropsWithChildren } from 'react';

import { ethereum, solana } from '@hyperlane-xyz/registry';
import { ProtocolType } from '@hyperlane-xyz/utils';

import { ChainLogo } from '../../components/icons/ChainLogo';
import { Modal } from '../../components/layout/Modal';

import { useConnectFns } from './hooks/multiProtocol';

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
          logoChainId={ethereum.chainId}
        >
          Ethereum
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          logoChainId={solana.chainId}
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
  logoChainId?: number | string;
  logo?: React.ReactElement;
  onClick?: () => void;
}>) {
  if (!logo) {
    if (!logoChainId) throw new Error('Either logo or logoChainId must be provided');
    if (typeof logoChainId !== 'number') throw new Error('logoChainId must be a number');
    logo = <ChainLogo chainId={logoChainId} size={34} />;
  }
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 space-y-2.5 flex flex-col items-center rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-gray-200 active:bg-gray-200 transition-all"
    >
      {logo}
      <div className="uppercase text-gray-800 tracking-wide">{children}</div>
      <div className="text-sm text-gray-500">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
