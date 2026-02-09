import { Form, Formik, useFormikContext } from 'formik';
import { ConnectAwareSubmitButton } from '../../components/buttons/ConnectAwareSubmitButton';
import { SwapIcon } from '../../components/icons/SwapIcon';
import { TextField } from '../../components/input/TextField';
import { TransferSection } from '../transfer/TransferSection';
import { DEFAULT_SLIPPAGE, SWAP_CHAINS, SWAP_CONTRACTS } from './swapConfig';
import { useSwapTransaction } from './useSwapTransaction';
import { SwapFormValues, SwapQuote, SwapStatus } from './types';

const tokenOptions = [
  { label: 'USDC', value: SWAP_CONTRACTS.usdcArb },
  { label: 'USDC.e', value: '' },
];

const destinationTokenOptions = [
  { label: 'USDC', value: SWAP_CONTRACTS.usdcBase },
  { label: 'USDbC', value: '' },
];

const initialQuote: SwapQuote = {
  originSwapRate: '--',
  bridgeFee: '--',
  destinationSwapRate: '--',
  estimatedOutput: '--',
  minimumReceived: '--',
  slippage: DEFAULT_SLIPPAGE,
};

export function SwapTokenForm() {
  const { status } = useSwapTransaction();

  const initialValues: SwapFormValues = {
    originChainId: SWAP_CHAINS.origin.chainId,
    destinationChainId: SWAP_CHAINS.destination.chainId,
    originTokenAddress: SWAP_CONTRACTS.usdcArb,
    destinationTokenAddress: SWAP_CONTRACTS.usdcBase,
    amount: '',
  };

  return (
    <Formik<SwapFormValues> initialValues={initialValues} onSubmit={() => {}}>
      <Form className="flex w-full flex-col items-stretch gap-1.5">
        <TransferSection label="From">
          <OriginSwapFields />
        </TransferSection>

        <DirectionIndicator />

        <TransferSection label="To">
          <DestinationSwapFields quote={initialQuote} />
        </TransferSection>

        <QuoteSummary quote={initialQuote} status={status} />

        <ConnectAwareSubmitButton<SwapFormValues>
          chainName="arbitrum"
          text="Review Swap"
          classes="mb-4 w-full px-3 py-2.5 font-secondary text-xl text-cream-100"
          disabled={status !== SwapStatus.Idle && status !== SwapStatus.ReviewMode}
        />
      </Form>
    </Formik>
  );
}

function OriginSwapFields() {
  return (
    <div>
      <ChainLabel chainName={SWAP_CHAINS.origin.name} />
      <div className="mt-2 rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <TokenSelector name="originTokenAddress" options={tokenOptions} />
        <div className="my-2.5 h-px bg-primary-50" />

        <TextField
          name="amount"
          placeholder="0"
          className="w-full border-none bg-transparent font-secondary text-xl font-normal text-gray-900 outline-none placeholder:text-gray-900"
          type="number"
          step="any"
        />

        <div className="mt-1 text-xs leading-[18px] text-gray-450">Balance: --</div>
      </div>
    </div>
  );
}

function DestinationSwapFields({ quote }: { quote: SwapQuote }) {
  return (
    <div>
      <ChainLabel chainName={SWAP_CHAINS.destination.name} />
      <div className="mt-2 rounded-[7px] border border-gray-400/25 bg-white p-3 shadow-input">
        <TokenSelector name="destinationTokenAddress" options={destinationTokenOptions} />
        <div className="my-2.5 h-px bg-primary-50" />
        <div className="font-secondary text-xl font-normal text-gray-900">
          Estimated output: {quote.estimatedOutput}
        </div>
      </div>
    </div>
  );
}

function QuoteSummary({ quote, status }: { quote: SwapQuote; status: SwapStatus }) {
  return (
    <div className="rounded border border-gray-400/25 bg-gray-150 px-3 py-2 text-sm text-gray-800">
      <div className="mb-1 font-secondary text-base text-gray-900">Quote summary</div>
      <div>Origin swap rate: {quote.originSwapRate}</div>
      <div>Bridge fee: {quote.bridgeFee}</div>
      <div>Destination swap rate: {quote.destinationSwapRate}</div>
      <div>Minimum received: {quote.minimumReceived}</div>
      <div>Slippage: {(quote.slippage * 100).toFixed(2)}%</div>
      <div>Status: {status}</div>
    </div>
  );
}

function DirectionIndicator() {
  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <div className="flex h-8 w-8 items-center justify-center rounded border border-gray-400/50 bg-white shadow-button">
        <SwapIcon width={18} height={24} />
      </div>
    </div>
  );
}

function ChainLabel({ chainName }: { chainName: string }) {
  return <div className="font-secondary text-sm font-medium text-gray-700">Chain: {chainName}</div>;
}

function TokenSelector({
  name,
  options,
}: {
  name: 'originTokenAddress' | 'destinationTokenAddress';
  options: { label: string; value: string }[];
}) {
  const { values, setFieldValue } = useFormikContext<SwapFormValues>();
  const value = values[name];

  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600">
      Token
      <select
        value={value}
        onChange={(event) => setFieldValue(name, event.target.value)}
        className="rounded border border-gray-300 bg-white px-3 py-2 text-gray-900"
      >
        {options.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
