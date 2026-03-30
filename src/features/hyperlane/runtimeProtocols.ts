import { type KnownProtocolType, ProtocolType } from '@hyperlane-xyz/utils';

export function getRuntimeProtocols(
  protocols: Array<ProtocolType | null | undefined>,
): KnownProtocolType[] {
  const normalized = new Set<KnownProtocolType>();

  for (const protocol of protocols) {
    if (!protocol || protocol === ProtocolType.Unknown) continue;
    normalized.add(
      protocol === ProtocolType.CosmosNative ? ProtocolType.Cosmos : protocol,
    );
  }

  return Array.from(normalized).sort();
}
