import type { ChainMetadata } from '@hyperlane-xyz/sdk/metadata/chainMetadataTypes';
import type { MultiProviderAdapter } from '@hyperlane-xyz/sdk/providers/MultiProviderAdapter';
import type {
  ProviderBuilderFn,
  ProviderBuilderMap,
} from '@hyperlane-xyz/sdk/providers/providerBuilders';
import type { TypedProvider } from '@hyperlane-xyz/sdk/providers/ProviderType';
import { ProviderType } from '@hyperlane-xyz/sdk/providers/ProviderType';
import type { ChainMap } from '@hyperlane-xyz/sdk/types';
import { type KnownProtocolType, ProtocolType } from '@hyperlane-xyz/utils';

type RuntimeMultiProvider = MultiProviderAdapter<{ mailbox?: string }>;
type TronBuildersModule = typeof import('@hyperlane-xyz/sdk/providers/builders/tron');

type SdkRuntime = {
  createMultiProvider: (
    chainMetadata: ChainMap<ChainMetadata<{ mailbox?: string }>>,
  ) => RuntimeMultiProvider;
  warpCore: typeof import('@hyperlane-xyz/sdk/warp/WarpCore').WarpCore;
};

const sdkRuntimePromises = new Map<string, Promise<SdkRuntime>>();

export function getSdkRuntime(protocols: KnownProtocolType[]): Promise<SdkRuntime> {
  const key = [...new Set(protocols)].sort().join(',');
  const cached = sdkRuntimePromises.get(key);
  if (cached) return cached;

  const runtimePromise = createSdkRuntime(protocols).catch((error) => {
    sdkRuntimePromises.delete(key);
    throw error;
  });
  sdkRuntimePromises.set(key, runtimePromise);
  return runtimePromise;
}

async function createSdkRuntime(protocols: KnownProtocolType[]): Promise<SdkRuntime> {
  const tronBuildersModulePromise = protocols.includes(ProtocolType.Tron)
    ? import('@hyperlane-xyz/sdk/providers/builders/tron')
    : Promise.resolve(undefined);
  const [{ MultiProviderAdapter }, { WarpCore }, tronBuildersModule, providerBuilders] =
    await Promise.all([
      import('@hyperlane-xyz/sdk/providers/MultiProviderAdapter'),
      import('@hyperlane-xyz/sdk/warp/WarpCore'),
      tronBuildersModulePromise,
      tronBuildersModulePromise.then((tronBuildersModule) =>
        getProviderBuilders(protocols, tronBuildersModule),
      ),
    ]);

  const defaultTronEthersProviderBuilder = tronBuildersModule?.defaultTronEthersProviderBuilder;

  // Keep this class scoped to the lazy runtime loader. Moving it to module scope would
  // require a top-level value import of MultiProviderAdapter and defeat the split.
  class RuntimeMultiProviderAdapter<
    MetaExt extends object = object,
  > extends MultiProviderAdapter<MetaExt> {
    protected override getProviderBuilder(
      protocol: ProtocolType,
      type: ProviderType,
    ): ProviderBuilderFn<TypedProvider> | undefined {
      if (
        protocol === ProtocolType.Tron &&
        type === ProviderType.EthersV5 &&
        defaultTronEthersProviderBuilder
      ) {
        return (urls, network) => ({
          type: ProviderType.EthersV5,
          provider: defaultTronEthersProviderBuilder(urls, network),
        });
      }

      return this.providerBuilders[type];
    }
  }

  return {
    createMultiProvider: (chainMetadata) =>
      new RuntimeMultiProviderAdapter(chainMetadata, {
        providerBuilders,
      }),
    warpCore: WarpCore,
  };
}

async function getProviderBuilders(
  protocols: KnownProtocolType[],
  tronBuildersModule?: TronBuildersModule,
): Promise<Partial<ProviderBuilderMap>> {
  const uniqueProtocols = new Set(protocols);
  const providerBuilders: Partial<ProviderBuilderMap> = {};

  if (uniqueProtocols.has(ProtocolType.Ethereum)) {
    const [{ defaultEthersV5ProviderBuilder }, { defaultViemProviderBuilder }] = await Promise.all([
      import('@hyperlane-xyz/sdk/providers/builders/ethersV5'),
      import('@hyperlane-xyz/sdk/providers/builders/viem'),
    ]);
    providerBuilders[ProviderType.EthersV5] = defaultEthersV5ProviderBuilder;
    providerBuilders[ProviderType.Viem] = defaultViemProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Cosmos) || uniqueProtocols.has(ProtocolType.CosmosNative)) {
    const {
      defaultCosmJsNativeProviderBuilder,
      defaultCosmJsProviderBuilder,
      defaultCosmJsWasmProviderBuilder,
    } = await import('@hyperlane-xyz/sdk/providers/builders/cosmos');
    providerBuilders[ProviderType.CosmJs] = defaultCosmJsProviderBuilder;
    providerBuilders[ProviderType.CosmJsWasm] = defaultCosmJsWasmProviderBuilder;
    providerBuilders[ProviderType.CosmJsNative] = defaultCosmJsNativeProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Sealevel)) {
    const { defaultSolProviderBuilder } =
      await import('@hyperlane-xyz/sdk/providers/builders/solana');
    providerBuilders[ProviderType.SolanaWeb3] = defaultSolProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Starknet)) {
    const { defaultStarknetJsProviderBuilder } =
      await import('@hyperlane-xyz/sdk/providers/builders/starknet');
    providerBuilders[ProviderType.Starknet] = defaultStarknetJsProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Radix)) {
    const { defaultRadixProviderBuilder } =
      await import('@hyperlane-xyz/sdk/providers/builders/radix');
    providerBuilders[ProviderType.Radix] = defaultRadixProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Aleo)) {
    const { defaultAleoProviderBuilder } =
      await import('@hyperlane-xyz/sdk/providers/builders/aleo');
    providerBuilders[ProviderType.Aleo] = defaultAleoProviderBuilder;
  }

  if (uniqueProtocols.has(ProtocolType.Tron)) {
    const { defaultTronProviderBuilder } =
      tronBuildersModule || (await import('@hyperlane-xyz/sdk/providers/builders/tron'));
    providerBuilders[ProviderType.Tron] = defaultTronProviderBuilder;
  }

  return providerBuilders;
}
