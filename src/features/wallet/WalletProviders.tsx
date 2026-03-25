import { PropsWithChildren } from 'react';
import { AleoWalletContext } from './context/AleoWalletContext';
import { CosmosWalletContext } from './context/CosmosWalletContext';
import { EvmWalletContext } from './context/EvmWalletContext';
import { RadixWalletContext } from './context/RadixWalletContext';
import { SolanaWalletContext } from './context/SolanaWalletContext';
import { StarknetWalletContext } from './context/StarknetWalletContext';
import { TronWalletContext } from './context/TronWalletContext';

export function WalletProviders({ children }: PropsWithChildren<unknown>) {
  return (
    <EvmWalletContext>
      <SolanaWalletContext>
        <CosmosWalletContext>
          <StarknetWalletContext>
            <RadixWalletContext>
              <AleoWalletContext>
                <TronWalletContext>{children}</TronWalletContext>
              </AleoWalletContext>
            </RadixWalletContext>
          </StarknetWalletContext>
        </CosmosWalletContext>
      </SolanaWalletContext>
    </EvmWalletContext>
  );
}
