import { WarningIcon } from '@hyperlane-xyz/widgets';

export function RecipientWarningBanner({
  destinationChain,
  confirmRecipientHandler,
}: {
  destinationChain: string;
  confirmRecipientHandler: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <WarningIcon width={40} height={40} />
      <div>
        <p className="my-2">
          The recipient address is the same as the currently connected smart contract wallet,{' '}
          <strong>but it does not exist as a smart contract on {destinationChain}</strong>.
        </p>
        <p className="my-2">This may result in losing access to your bridged tokens.</p>
        <p className="my-2">
          <strong>
            Only proceed if you are certain you have control over this address on {destinationChain}
          </strong>
        </p>
        <div className="justify-left flex w-max gap-2 rounded bg-white/30 px-2.5 py-1 text-center hover:bg-white/50 active:bg-white/60">
          <input
            onChange={({ target: { checked } }) => confirmRecipientHandler(checked)}
            type="checkbox"
            id="confirm-address"
            name="confirm-recipient"
          />
          <label htmlFor="confirm-address">I have control and want to bridge to this address</label>
        </div>
      </div>
    </div>
  );
}
