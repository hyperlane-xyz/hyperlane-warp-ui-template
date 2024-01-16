import { ProtocolType } from '@hyperlane-xyz/utils';

import { logger } from '../../utils/logger';

// Based mostly on https://chainagnostic.org/CAIPs/caip-2
// But uses different naming for the protocol
export function getCaip2Id(protocol: ProtocolType, reference: string | number): ChainCaip2Id {
  if (!Object.values(ProtocolType).includes(protocol)) {
    throw new Error(`Invalid chain environment: ${protocol}`);
  }
  if (
    ([ProtocolType.Ethereum, ProtocolType.Sealevel].includes(protocol) &&
      (typeof reference !== 'number' || reference <= 0)) ||
    (protocol === ProtocolType.Cosmos && typeof reference !== 'string')
  ) {
    throw new Error(`Invalid chain reference: ${reference}`);
  }
  return `${protocol}:${reference}`;
}

export function parseCaip2Id(id: ChainCaip2Id) {
  const [_protocol, reference] = id.split(':');
  const protocol = _protocol as ProtocolType;
  if (!Object.values(ProtocolType).includes(protocol)) {
    throw new Error(`Invalid chain protocol type: ${id}`);
  }
  if (!reference) {
    throw new Error(`No reference found in caip2 id: ${id}`);
  }
  return { protocol, reference };
}

export function tryParseCaip2Id(id?: ChainCaip2Id) {
  if (!id) return undefined;
  try {
    return parseCaip2Id(id);
  } catch (err) {
    logger.error(`Error parsing caip2 id ${id}`, err);
    return undefined;
  }
}

export function getProtocolType(id: ChainCaip2Id) {
  const { protocol } = parseCaip2Id(id);
  return protocol;
}

export function tryGetProtocolType(id?: ChainCaip2Id) {
  return tryParseCaip2Id(id)?.protocol;
}

export function getChainReference(id: ChainCaip2Id) {
  const { reference } = parseCaip2Id(id);
  return reference;
}

export function tryGetChainReference(id?: ChainCaip2Id) {
  return tryParseCaip2Id(id)?.reference;
}

export function getEthereumChainId(id: ChainCaip2Id): number {
  const { protocol, reference } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Ethereum) {
    throw new Error(`Protocol type must be ethereum: ${id}`);
  }
  return parseInt(reference, 10);
}
