export enum Environment {
  Mainnet = 'mainnet',
  Testnet2 = 'testnet2',
}

export const environments = Object.values(Environment);

export const envDisplayValue = {
  [Environment.Mainnet]: 'Mainnet',
  [Environment.Testnet2]: 'Testnet',
};
