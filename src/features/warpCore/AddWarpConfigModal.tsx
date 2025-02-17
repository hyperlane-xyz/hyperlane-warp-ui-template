import { warpRouteConfigToId } from '@hyperlane-xyz/registry';
import { MultiProtocolProvider, WarpCoreConfig, WarpCoreConfigSchema } from '@hyperlane-xyz/sdk';
import { failure, Result, success, tryParseJsonOrYaml } from '@hyperlane-xyz/utils';
import { Button, CopyButton, IconButton, Modal, PlusIcon, XIcon } from '@hyperlane-xyz/widgets';
import clsx from 'clsx';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { Color } from '../../styles/Color';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { useStore } from '../store';

export function AddWarpConfigModal({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const { warpCoreConfigOverrides, setWarpCoreConfigOverrides } = useStore(
    ({ warpCoreConfigOverrides, setWarpCoreConfigOverrides }) => ({
      warpCoreConfigOverrides,
      setWarpCoreConfigOverrides,
    }),
  );

  const onAddConfig = (warpCoreConfig: WarpCoreConfig) => {
    setWarpCoreConfigOverrides([...warpCoreConfigOverrides, warpCoreConfig]);
    toast.success('Warp config added!');
    close();
  };

  const onRemoveConfig = (index: number) => {
    setWarpCoreConfigOverrides(warpCoreConfigOverrides.filter((_, i) => i !== index));
    toast.success('Warp config removed');
  };

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      panelClassname="px-4 py-3 max-w-lg flex flex-col items-center gap-2"
    >
      <h2 className="text-center text-primary-500">Add Warp Route Configs</h2>
      <p className="text-xs">
        Add warp route configs, like those from the Hyperlane CLI. Note, these routes will be
        available only in your own browser.
      </p>
      <Form onAdd={onAddConfig} />
      <ConfigList warpCoreConfigOverrides={warpCoreConfigOverrides} onRemove={onRemoveConfig} />
    </Modal>
  );
}

// TODO de-dupe with Form in ChainAddMenu in widgets lib
function Form({ onAdd }: { onAdd: (warpCoreConfig: WarpCoreConfig) => void }) {
  const multiProvider = useMultiProvider();
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<any>(null);

  const onChangeInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTextInput(e.target.value);
    setError(null);
  };

  const onClickAdd = () => {
    const result = tryParseConfigInput(textInput, multiProvider);
    if (result.success) {
      onAdd(result.data);
    } else {
      setError(`Invalid config: ${result.error}`);
    }
  };

  return (
    <>
      <div className="relative w-full">
        <textarea
          className={clsx(
            'min-h-72 w-full resize rounded-sm border border-gray-200 p-2 text-xs outline-none focus:border-gray-400',
            error && 'border-red-500',
          )}
          placeholder={placeholderText}
          value={textInput}
          onChange={onChangeInput}
        ></textarea>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <CopyButton
          copyValue={textInput || placeholderText}
          width={14}
          height={14}
          className="absolute right-5 top-3"
        />
      </div>
      <Button
        onClick={onClickAdd}
        className="w-full gap-1 bg-accent-500 px-3 py-1.5 text-sm text-white"
      >
        <PlusIcon width={20} height={20} color={Color.white} />
        <span>Add Config</span>
      </Button>
    </>
  );
}

function ConfigList({
  warpCoreConfigOverrides,
  onRemove,
}: {
  warpCoreConfigOverrides: WarpCoreConfig[];
  onRemove: (index: number) => void;
}) {
  if (!warpCoreConfigOverrides.length) return null;

  return (
    <div className="mt-2 flex w-full flex-col gap-2 border-t pt-3">
      {warpCoreConfigOverrides.map((config, i) => (
        <div key={i} className="flex items-center justify-between gap-1">
          <span className="truncate text-xs">{warpRouteConfigToId(config)}</span>
          <IconButton onClick={() => onRemove(i)} title="Remove config">
            <XIcon width={10} height={10} color={Color.gray['800']} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function tryParseConfigInput(
  input: string,
  multiProvider: MultiProtocolProvider,
): Result<WarpCoreConfig> {
  const parsed = tryParseJsonOrYaml(input);
  if (!parsed.success) return parsed;

  const result = WarpCoreConfigSchema.safeParse(parsed.data);

  if (!result.success) {
    logger.warn('Error validating warp config', result.error);
    const firstIssue = result.error.issues[0];
    return failure(`${firstIssue.path} => ${firstIssue.message}`);
  }

  const warpConfig = result.data;
  const warpChains = warpConfig.tokens.map((t) => t.chainName);
  const unknownChain = warpChains.find((c) => !multiProvider.hasChain(c));

  if (unknownChain) {
    return failure(`Unknown chain: ${unknownChain}`);
  }

  return success(result.data);
}

const placeholderText = `# YAML config data
---
tokens:
  - addressOrDenom: "0x123..."
    chainName: ethereum
    collateralAddressOrDenom: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    connections:
      - token: ethereum|mycoolchain|0x345...
    decimals: 6
    name: USDC
    standard: EvmHypCollateral
    symbol: USDC
  - addressOrDenom: "0x345..."
    chainName: mycoolchain
    connections:
      - token: ethereum|ethereum|0x123...
    decimals: 6
    name: USDC
    standard: EvmHypSynthetic
    symbol: USDC
options: {}
`;
