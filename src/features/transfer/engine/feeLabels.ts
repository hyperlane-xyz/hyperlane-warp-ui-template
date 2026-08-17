import type { FeeComponent } from './types';

export const FEE_CATEGORY_LABEL: Record<FeeComponent['category'], string> = {
  bridge: 'Route Fee',
  igp: 'Interchain Gas',
  source: 'Source Gas',
};
