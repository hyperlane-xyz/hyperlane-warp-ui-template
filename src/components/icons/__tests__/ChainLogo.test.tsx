import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChainMetadata } from '../../../features/chains/hooks';
import { ChainLogo } from '../ChainLogo';

// Mock dependencies
vi.mock('@hyperlane-xyz/widgets', () => ({
  ChainLogo: ({ chainName, size, background }: any) => (
    <div
      data-testid="chain-logo"
      data-chain={chainName}
      data-size={size}
      data-background={background}
    >
      Chain Logo
    </div>
  ),
}));

vi.mock('../../../features/chains/hooks', () => ({
  useChainMetadata: vi.fn(),
}));

vi.mock('../../../features/store', () => ({
  useStore: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

describe('ChainLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with chain metadata', () => {
    (useChainMetadata as any).mockReturnValue({
      name: 'ethereum',
      logoURI: '/images/chains/ethereum.svg',
    });

    const { getByTestId } = render(<ChainLogo chainName="ethereum" />);
    expect(getByTestId('chain-logo')).toBeInTheDocument();
  });

  it('should render with custom size', () => {
    (useChainMetadata as any).mockReturnValue({
      name: 'ethereum',
      logoURI: '/images/chains/ethereum.svg',
    });

    const { getByTestId } = render(<ChainLogo chainName="ethereum" size={48} />);
    const logo = getByTestId('chain-logo');
    expect(logo).toHaveAttribute('data-size', '48');
  });

  it('should render with background', () => {
    (useChainMetadata as any).mockReturnValue({
      name: 'ethereum',
      logoURI: '/images/chains/ethereum.svg',
    });

    const { getByTestId } = render(<ChainLogo chainName="ethereum" background={true} />);
    const logo = getByTestId('chain-logo');
    expect(logo).toHaveAttribute('data-background', 'true');
  });

  it('should handle missing chain metadata', () => {
    (useChainMetadata as any).mockReturnValue(null);

    const { getByTestId } = render(<ChainLogo chainName="unknown" />);
    expect(getByTestId('chain-logo')).toBeInTheDocument();
  });

  it('should handle chain without logoURI', () => {
    (useChainMetadata as any).mockReturnValue({
      name: 'testchain',
    });

    const { getByTestId } = render(<ChainLogo chainName="testchain" />);
    expect(getByTestId('chain-logo')).toBeInTheDocument();
  });
});
