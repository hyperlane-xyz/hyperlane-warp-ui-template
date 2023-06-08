import { ProtocolType } from './types';

// Based on https://chainagnostic.org/CAIPs/caip-2
export function getCaip2Id(protocol: ProtocolType, reference: string | number): Caip2Id {
  if (!Object.values(ProtocolType).includes(protocol)) {
    throw new Error(`Invalid chain environment: ${protocol}`);
  }
  if (!reference) {
    throw new Error(`Reference required: ${reference}`);
  }
  if (protocol === ProtocolType.Ethereum && (typeof reference !== 'number' || reference < 0)) {
    throw new Error(`Invalid evm chain reference (id): ${reference}`);
  }
  if (
    protocol === ProtocolType.Sealevel &&
    !reference // TODO decide what these should be (strings or nums)
  ) {
    throw new Error(`Invalid solana chain reference: ${reference}`);
  }
  return `${protocol}:${reference}`;
}

export function parseCaip2Id(id: Caip2Id) {
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

export function getProtocolType(id: Caip2Id) {
  const { protocol } = parseCaip2Id(id);
  return protocol;
}

export function getChainReference(id: Caip2Id) {
  const { reference } = parseCaip2Id(id);
  return reference;
}

export function getEthereumChainId(id: Caip2Id): number {
  const { protocol, reference } = parseCaip2Id(id);
  if (protocol !== ProtocolType.Ethereum) {
    throw new Error(`Protocol type must be ethereum: ${id}`);
  }
  return parseInt(reference, 10);
}
