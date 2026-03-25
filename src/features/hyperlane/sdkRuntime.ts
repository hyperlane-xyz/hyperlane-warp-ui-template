type SdkRuntime = {
  MultiProtocolProvider:
    typeof import('@hyperlane-xyz/sdk/providers/MultiProtocolProvider').MultiProtocolProvider;
  WarpCore: typeof import('@hyperlane-xyz/sdk/warp/WarpCore').WarpCore;
};

let sdkRuntimePromise: Promise<SdkRuntime> | undefined;

export function getSdkRuntime(): Promise<SdkRuntime> {
  sdkRuntimePromise ??= Promise.all([
    import('@hyperlane-xyz/sdk/providers/MultiProtocolProvider'),
    import('@hyperlane-xyz/sdk/warp/WarpCore'),
  ]).then(([{ MultiProtocolProvider }, { WarpCore }]) => ({
    MultiProtocolProvider,
    WarpCore,
  }));
  return sdkRuntimePromise;
}
