import Image from 'next/image';
import { PropsWithChildren } from 'react';

import { ethereum, solanamainnet } from '@hyperlane-xyz/registry';
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
      <div className="flex flex-col space-y-2.5 pb-2 pt-4">
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
          logoChainId={solanamainnet.chainId}
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
      className="flex w-full flex-col items-center space-y-2.5 rounded-lg border border-gray-200 py-3.5 transition-all hover:border-gray-200 hover:bg-gray-100 active:bg-gray-200"
    >
      {logo}
      <div className="tracking-wide text-gray-800">{children}</div>
      <div className="text-sm text-gray-500">{`Connect to ${subTitle} compatible wallet`}</div>
    </button>
  );
}
