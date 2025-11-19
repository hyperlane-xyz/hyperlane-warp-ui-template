import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MouseEventHandler, PropsWithChildren, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddWarpConfigModal } from '../AddWarpConfigModal';

const {
  mockConfig,
  mockSetWarpCoreConfigOverrides,
  mockToastSuccess,
  mockMultiProvider,
  mockTryParseJsonOrYaml,
  mockSafeParse,
} = vi.hoisted(() => {
  const config = {
    tokens: [
      {
        chainName: 'ethereum',
      },
    ],
    options: {},
  } as any;

  return {
    mockConfig: config,
    mockSetWarpCoreConfigOverrides: vi.fn().mockResolvedValue(undefined),
    mockToastSuccess: vi.fn(),
    mockMultiProvider: { hasChain: vi.fn(() => true) },
    mockTryParseJsonOrYaml: vi.fn(() => ({ success: true, data: config })) as unknown as any,
    mockSafeParse: vi.fn(() => ({ success: true, data: config })) as unknown as any,
  };
});

let storeState = {
  warpCoreConfigOverrides: [] as any[],
  setWarpCoreConfigOverrides: mockSetWarpCoreConfigOverrides,
  multiProvider: mockMultiProvider,
};

vi.mock('../../store', () => ({
  useStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

vi.mock('@hyperlane-xyz/widgets', () => ({
  Modal: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
  Button: ({
    children,
    onClick,
    ...rest
  }: PropsWithChildren<{ onClick?: MouseEventHandler<HTMLButtonElement> }>) => (
    <button onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  CopyButton: () => null,
  IconButton: ({
    onClick,
    title,
    children,
  }: PropsWithChildren<{
    onClick?: MouseEventHandler<HTMLButtonElement>;
    title?: string;
  }>) => (
    <button onClick={onClick} title={title} aria-label={title}>
      {children}
    </button>
  ),
  PlusIcon: () => null,
  XIcon: () => null,
}));

vi.mock('@hyperlane-xyz/utils', async () => {
  const actual =
    await vi.importActual<typeof import('@hyperlane-xyz/utils')>('@hyperlane-xyz/utils');
  return {
    ...actual,
    tryParseJsonOrYaml: mockTryParseJsonOrYaml,
  };
});

vi.mock('@hyperlane-xyz/sdk', async () => {
  const actual = await vi.importActual<typeof import('@hyperlane-xyz/sdk')>('@hyperlane-xyz/sdk');
  return {
    ...actual,
    WarpCoreConfigSchema: {
      ...actual.WarpCoreConfigSchema,
      safeParse: mockSafeParse,
    },
  };
});

vi.mock('@hyperlane-xyz/registry', () => ({
  BaseRegistry: { warpRouteConfigToId: () => 'mock-id' },
}));

vi.mock('react-toastify', () => ({
  toast: { success: mockToastSuccess },
}));

describe('AddWarpConfigModal', () => {
  const closeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeState = {
      warpCoreConfigOverrides: [],
      setWarpCoreConfigOverrides: mockSetWarpCoreConfigOverrides,
      multiProvider: mockMultiProvider,
    };
    mockMultiProvider.hasChain.mockReturnValue(true);
    mockTryParseJsonOrYaml.mockReturnValue({ success: true, data: mockConfig });
    mockSafeParse.mockReturnValue({ success: true, data: mockConfig });
  });

  it('renders the modal content when open', () => {
    render(<AddWarpConfigModal isOpen={true} close={closeMock} />);

    expect(screen.getByText('Add Warp Route Configs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add config/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<AddWarpConfigModal isOpen={false} close={closeMock} />);

    expect(screen.queryByText('Add Warp Route Configs')).not.toBeInTheDocument();
  });

  it('adds a config and closes the modal on success', async () => {
    render(<AddWarpConfigModal isOpen={true} close={closeMock} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'config value' } });
    fireEvent.click(screen.getByRole('button', { name: /add config/i }));

    await waitFor(() => {
      expect(mockSetWarpCoreConfigOverrides).toHaveBeenCalledWith([mockConfig]);
      expect(mockToastSuccess).toHaveBeenCalledWith('Warp config added!');
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an error when parsing fails', () => {
    mockTryParseJsonOrYaml.mockReturnValueOnce({ success: false, error: 'bad config' });

    render(<AddWarpConfigModal isOpen={true} close={closeMock} />);

    fireEvent.click(screen.getByRole('button', { name: /add config/i }));

    expect(screen.getByText('Invalid config: bad config')).toBeInTheDocument();
    expect(mockSetWarpCoreConfigOverrides).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('removes a config via the list control', () => {
    storeState.warpCoreConfigOverrides = [mockConfig];

    render(<AddWarpConfigModal isOpen={true} close={closeMock} />);

    fireEvent.click(screen.getByLabelText('Remove config'));

    expect(mockSetWarpCoreConfigOverrides).toHaveBeenCalledWith([]);
    expect(mockToastSuccess).toHaveBeenCalledWith('Warp config removed');
  });
});
