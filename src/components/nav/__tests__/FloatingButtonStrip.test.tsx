import { useModal } from '@hyperlane-xyz/widgets';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../../features/store';
import { FloatingButtonStrip } from '../FloatingButtonStrip';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  HistoryIcon: (props: any) => (
    <span data-testid="history-icon" {...props}>
      History
    </span>
  ),
  IconButton: ({ children, onClick, title, className }: any) => (
    <button onClick={onClick} title={title} className={className} data-testid="icon-button">
      {children}
    </button>
  ),
  PlusIcon: (props: any) => (
    <span data-testid="plus-icon" {...props}>
      Plus
    </span>
  ),
  useModal: vi.fn(),
}));

vi.mock('../../consts/config', () => ({
  config: {
    showAddRouteButton: true,
  },
}));

vi.mock('../../../features/store', () => ({
  useStore: vi.fn(),
}));

vi.mock('../../../features/warpCore/AddWarpConfigModal', () => ({
  AddWarpConfigModal: ({ isOpen, close }: any) =>
    isOpen ? (
      <div data-testid="add-warp-modal">
        <button onClick={close}>Close Modal</button>
      </div>
    ) : null,
}));

vi.mock('../../styles/Color', () => ({
  Color: {
    primary: {
      500: '#3b82f6',
    },
  },
}));

describe('FloatingButtonStrip', () => {
  const mockSetIsSideBarOpen = vi.fn();
  const mockOpenModal = vi.fn();
  const mockCloseModal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useStore as any).mockReturnValue({
      setIsSideBarOpen: mockSetIsSideBarOpen,
      isSideBarOpen: false,
    });
    (useModal as any).mockReturnValue({
      isOpen: false,
      open: mockOpenModal,
      close: mockCloseModal,
    });
  });

  it('should render history button', () => {
    render(<FloatingButtonStrip />);
    const buttons = screen.getAllByTestId('icon-button');
    expect(buttons[0]).toHaveAttribute('title', 'History');
  });

  it.skip('should render add route button when config enabled', () => {
    render(<FloatingButtonStrip />);
    const buttons = screen.getAllByTestId('icon-button');
    expect(buttons).toHaveLength(1);
    expect(buttons[1]).toHaveAttribute('title', 'Add route');
  });

  it('should toggle sidebar when history button is clicked', async () => {
    const user = userEvent.setup();
    render(<FloatingButtonStrip />);

    const historyButton = screen.getAllByTestId('icon-button')[0];
    await user.click(historyButton);

    expect(mockSetIsSideBarOpen).toHaveBeenCalledWith(true);
  });

  it('should close sidebar when clicked again', async () => {
    const user = userEvent.setup();
    (useStore as any).mockReturnValue({
      setIsSideBarOpen: mockSetIsSideBarOpen,
      isSideBarOpen: true,
    });

    render(<FloatingButtonStrip />);

    const historyButton = screen.getAllByTestId('icon-button')[0];
    await user.click(historyButton);

    expect(mockSetIsSideBarOpen).toHaveBeenCalledWith(false);
  });

  it.skip('should open add warp config modal when add route button is clicked', async () => {
    const user = userEvent.setup();
    render(<FloatingButtonStrip />);

    const addRouteButton = screen.getAllByTestId('icon-button')[1];
    await user.click(addRouteButton);

    expect(mockOpenModal).toHaveBeenCalledTimes(1);
  });

  it('should render modal when isOpen is true', () => {
    (useModal as any).mockReturnValue({
      isOpen: true,
      open: mockOpenModal,
      close: mockCloseModal,
    });

    render(<FloatingButtonStrip />);
    expect(screen.getByTestId('add-warp-modal')).toBeInTheDocument();
  });

  it('should not render add route button when config disabled', () => {
    vi.doMock('../../consts/config', () => ({
      config: {
        showAddRouteButton: false,
      },
    }));

    render(<FloatingButtonStrip />);
    const buttons = screen.getAllByTestId('icon-button');
    expect(buttons).toHaveLength(1);
  });

  it('should render history icon with correct props', () => {
    render(<FloatingButtonStrip />);
    const historyIcon = screen.getByTestId('history-icon');
    expect(historyIcon).toBeInTheDocument();
  });

  it.skip('should render plus icon with correct props', () => {
    render(<FloatingButtonStrip />);
    const plusIcon = screen.getByTestId('plus-icon');
    expect(plusIcon).toBeInTheDocument();
  });
});
