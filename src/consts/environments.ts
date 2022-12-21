export enum Environment {
  Mainnet = 'mainnet',
  Testnet2 = 'testnet2',
  Testnet3 = 'testnet3',
}

export const environments = Object.values(Environment);

export const envDisplayValue = {
  [Environment.Mainnet]: 'Mainnet',
  [Environment.Testnet2]: 'Testnet',
  [Environment.Testnet3]: 'Testnet',
};
