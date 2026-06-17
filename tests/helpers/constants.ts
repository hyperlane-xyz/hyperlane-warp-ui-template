import { config } from '../../src/consts/config';

export function resolveTestTokenParams(): {
  origin: string;
  originToken: string;
  destination: string;
  destinationToken: string;
  skip: boolean;
} {
  const origin = splitTokenId(config.defaultSwapOriginToken);
  const destination = splitTokenId(config.defaultSwapDestinationToken);

  if (!origin || !destination) {
    return {
      origin: '',
      originToken: '',
      destination: '',
      destinationToken: '',
      skip: true,
    };
  }

  return {
    origin: origin.chainName,
    originToken: origin.address,
    destination: destination.chainName,
    destinationToken: destination.address,
    skip: false,
  };
}

export function splitTokenId(id: string | undefined): { chainName: string; address: string } | null {
  if (!id) return null;
  const separator = id.indexOf('-');
  if (separator === -1) return null;
  return {
    chainName: id.slice(0, separator),
    address: id.slice(separator + 1),
  };
}
