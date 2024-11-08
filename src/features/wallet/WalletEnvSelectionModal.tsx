import { ethereum, solanamainnet } from '@hyperlane-xyz/registry';
import { ProtocolType } from '@hyperlane-xyz/utils';
import Image from 'next/image';
import { PropsWithChildren } from 'react';
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
          logoChainName={ethereum.name}
        >
          Ethereum
        </EnvButton>
        <EnvButton
          onClick={onClickEnv(ProtocolType.Sealevel)}
          subTitle="a Solana"
          logoChainName={solanamainnet.name}
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
  logoChainName,
  children,
}: PropsWithChildren<{
  subTitle: string;
  logoChainName?: ChainName;
  logo?: React.ReactElement;
  onClick?: () => void;
}>) {
  if (!logo) {
    if (!logoChainName) throw new Error('Either logo or logoChainName must be provided');
    logo = <ChainLogo chainName={logoChainName} size={34} />;
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
