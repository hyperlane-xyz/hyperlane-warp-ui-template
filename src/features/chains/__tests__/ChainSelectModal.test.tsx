import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChainSelectListModal } from '../ChainSelectModal';

vi.mock('../../../consts/config.ts', () => ({
  config: {
    shouldDisableChains: false,
    showAddChainButton: false,
  },
}));

const storeState = vi.hoisted(() => ({
  chainMetadata: {},
  chainMetadataOverrides: {},
  setChainMetadataOverrides: vi.fn(),
}));

vi.mock('../store', () => ({
  useStore: (selector: any) => selector(storeState),
}));

const { chainSearchMenuMock, modalMock } = vi.hoisted(() => ({
  chainSearchMenuMock: vi.fn(() => null),
  modalMock: vi.fn(({ isOpen, children }: any) => (isOpen ? <div>{children}</div> : null)),
}));

vi.mock('@hyperlane-xyz/widgets', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@hyperlane-xyz/widgets');
  return {
    ...actual,
    ChainSearchMenu: chainSearchMenuMock,
    Modal: modalMock,
  };
});

describe('ChainSelectListModal', () => {
  const chainMetadata = {
    sepolia: { name: 'sepolia' },
  } as any;
  const overrides = {
    sepolia: { displayName: 'Sepolia' },
  } as any;
  const setOverrides = vi.fn();

  beforeEach(() => {
    chainSearchMenuMock.mockReset();
    modalMock.mockReset();
    setOverrides.mockReset();
    Object.assign(storeState, {
      chainMetadata,
      chainMetadataOverrides: overrides,
      setChainMetadataOverrides: setOverrides,
    });
  });

  it('renders ChainSearchMenu when open with store data', () => {
    render(
      <ChainSelectListModal
        isOpen
        close={vi.fn()}
        onSelect={vi.fn()}
        customListItemField={'displayName' as any}
      />,
    );

    expect(chainSearchMenuMock).toHaveBeenCalledTimes(1);
    const props = (chainSearchMenuMock.mock.calls as any[])[0][0];
    expect(typeof props.onChangeOverrideMetadata).toBe('function');
    expect(props.customListItemField).toBe('displayName');
  });

  it('does not render contents when closed', () => {
    render(<ChainSelectListModal isOpen={false} close={vi.fn()} onSelect={vi.fn()} />);

    expect(chainSearchMenuMock).not.toHaveBeenCalled();
  });

  it('invokes onSelect and close when a chain is picked', () => {
    const onSelect = vi.fn();
    const close = vi.fn();

    render(<ChainSelectListModal isOpen close={close} onSelect={onSelect} />);

    const props = (chainSearchMenuMock.mock.calls as any[])[0][0];
    props.onClickChain({ name: 'arbitrum' } as any);

    expect(onSelect).toHaveBeenCalledWith('arbitrum');
    expect(close).toHaveBeenCalled();
  });
});
