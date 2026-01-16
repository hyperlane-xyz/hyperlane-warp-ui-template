import { config } from '../../consts/config';

const REFINER_PROJECT_ID = process.env.NEXT_PUBLIC_REFINER_PROJECT_ID || '';
const REFINER_TRANSFER_FORM_ID = process.env.NEXT_PUBLIC_REFINER_TRANSFER_FORM_ID || '';

type RefinerFn = (method: string, ...args: unknown[]) => void;

let refiner: RefinerFn | null = null;

/**
 * Initialize Refiner SDK
 * Should be called once when the app loads
 */
export async function initRefiner(): Promise<void> {
  if (typeof window === 'undefined' || refiner || !REFINER_PROJECT_ID) return;
  const module = await import('refiner-js');
  refiner = module.default;
  refiner('setProject', REFINER_PROJECT_ID);
}

/**
 * Identify user and show the transfer survey form
 */
export function refinerIdentifyAndShowTransferForm(params: {
  walletAddress: string;
  protocol: string;
  chain: string;
}): void {
  if (!config.enableTrackingEvents || !refiner || !REFINER_TRANSFER_FORM_ID) return;

  refiner('identifyUser', {
    id: params.walletAddress,
    wallet_address: params.walletAddress,
    protocol: params.protocol,
    chain: params.chain,
  });
  refiner('showForm', REFINER_TRANSFER_FORM_ID);
}
