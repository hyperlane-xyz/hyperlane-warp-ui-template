/* eslint-disable @typescript-eslint/no-unused-vars */
import { BigNumber, PopulatedTransaction, Signer, providers } from 'ethers';

import type { ERC20Upgradeable, HypERC20 } from '@hyperlane-xyz/hyperlane-token';
import { utils } from '@hyperlane-xyz/utils';

import {
  addressToByteHexString,
  isValidEvmAddress,
  normalizeEvmAddress,
} from '../../../utils/addresses';
import {
  getErc20Contract,
  getHypErc20CollateralContract,
  getHypErc20Contract,
} from '../contracts/evmContracts';
import { MinimalTokenMetadata } from '../types';

import {
  IHypTokenAdapter,
  ITokenAdapter,
  TransferParams,
  TransferRemoteParams,
} from './ITokenAdapter';

type SignerOrProvider = Signer | providers.Provider;

// Interacts with native currencies
export class EvmNativeTokenAdapter implements ITokenAdapter {
  constructor(public readonly signerOrProvider: SignerOrProvider) {}

  async getBalance(address?: Address): Promise<string> {
    const balanceAddress = await this.resolveAddress(address);
    if (!isValidEvmAddress(balanceAddress)) return '0';
    const balance = await this.signerOrProvider.getBalance(balanceAddress);
    return balance.toString();
  }

  async getMetadata(): Promise<MinimalTokenMetadata> {
    // TODO get metadata from chainMetadata config
    throw new Error('Metadata not available to native tokens');
  }

  async populateApproveTx(_params: TransferParams): Promise<PopulatedTransaction> {
    throw new Error('Approve not required for native tokens');
  }

  async populateTransferTx({
    amountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    const value = BigNumber.from(amountOrId);
    return { value, to: recipient };
  }

  protected resolveAddress(address?: Address): Address | Promise<Address> {
    if (address) return address;
    else if (Signer.isSigner(this.signerOrProvider)) {
      return this.signerOrProvider.getAddress();
    } else {
      throw new Error('No address provided');
    }
  }
}

// Interacts with ERC20/721 contracts
export class EvmTokenAdapter<T extends ERC20Upgradeable = ERC20Upgradeable>
  extends EvmNativeTokenAdapter
  implements ITokenAdapter
{
  public readonly contract: T;

  constructor(
    public readonly signerOrProvider: SignerOrProvider,
    public readonly contractAddress: Address,
    // @ts-ignore Compiler not understanding that factory is valid here
    contractFactory: (a: Address, s: SignerOrProvider) => T = getErc20Contract,
  ) {
    super(signerOrProvider);
    this.contract = contractFactory(contractAddress, signerOrProvider);
  }

  override async getBalance(address?: Address): Promise<string> {
    const balanceAddress = await this.resolveAddress(address);
    const balance = await this.contract.balanceOf(balanceAddress);
    return balance.toString();
  }

  override async getMetadata(isNft?: boolean): Promise<MinimalTokenMetadata> {
    const [decimals, symbol, name] = await Promise.all([
      !isNft ? this.contract.decimals() : 0,
      this.contract.symbol(),
      this.contract.name(),
    ]);
    return { decimals, symbol, name };
  }

  override populateApproveTx({
    amountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    return this.contract.populateTransaction.approve(recipient, amountOrId);
  }

  override populateTransferTx({
    amountOrId,
    recipient,
  }: TransferParams): Promise<PopulatedTransaction> {
    return this.contract.populateTransaction.transfer(recipient, amountOrId);
  }
}

// Interacts with Hyp Synthetic token contracts (aka 'HypTokens')
export class EvmHypSyntheticAdapter<T extends HypERC20 = HypERC20>
  extends EvmTokenAdapter<T>
  implements IHypTokenAdapter
{
  constructor(
    public readonly signerOrProvider: SignerOrProvider,
    public readonly contractAddress: Address,
  ) {
    // @ts-ignore Compiler not understanding that factory is valid here
    super(signerOrProvider, contractAddress, getHypErc20Contract);
  }

  getDomains(): Promise<DomainId[]> {
    return this.contract.domains();
  }

  async getRouterAddress(domain: DomainId): Promise<Address> {
    const routerAddressesAsBytes32 = await this.contract.routers(domain);
    return normalizeEvmAddress(utils.bytes32ToAddress(routerAddressesAsBytes32));
  }

  async getAllRouters(): Promise<Array<{ domain: DomainId; address: Address }>> {
    const domains = await this.getDomains();
    const routers: Address[] = await Promise.all(domains.map((d) => this.getRouterAddress(d)));
    return domains.map((d, i) => ({ domain: d, address: routers[i] }));
  }

  async quoteGasPayment(destination: DomainId): Promise<string> {
    const gasPayment = await this.contract.quoteGasPayment(destination);
    return gasPayment.toString();
  }

  populateTransferRemoteTx({
    amountOrId,
    destination,
    recipient,
    txValue,
  }: TransferRemoteParams): Promise<PopulatedTransaction> {
    const recipBytes32 = utils.addressToBytes32(addressToByteHexString(recipient));
    return this.contract.populateTransaction.transferRemote(destination, recipBytes32, amountOrId, {
      value: txValue,
    });
  }
}

// Interacts with HypCollateral and HypNative contracts
export class EvmHypCollateralAdapter extends EvmHypSyntheticAdapter implements IHypTokenAdapter {
  constructor(
    public readonly signerOrProvider: SignerOrProvider,
    public readonly contractAddress: Address,
  ) {
    // @ts-ignore Workaround for lack of TS multiple inheritance
    super(signerOrProvider, contractAddress, getHypErc20CollateralContract);
  }

  override getMetadata(): Promise<MinimalTokenMetadata> {
    // TODO pass through metadata from wrapped token or chainMetadata config
    throw new Error('Metadata not available for HypCollateral/HypNative contract.');
  }

  override populateApproveTx(_params: TransferParams): Promise<PopulatedTransaction> {
    throw new Error('Approve not applicable to HypCollateral/HypNative contract.');
  }

  override populateTransferTx(_params: TransferParams): Promise<PopulatedTransaction> {
    throw new Error('Local transfer not supported for HypCollateral/HypNative contract.');
  }
}
