import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WarningBanner } from '../WarningBanner';

describe('WarningBanner', () => {
  it('should render when isVisible is true', () => {
    render(<WarningBanner isVisible={true}>Warning message</WarningBanner>);
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should not display content when isVisible is false', () => {
    const { container } = render(<WarningBanner isVisible={false}>Warning message</WarningBanner>);
    const banner = container.querySelector('.max-h-0');
    expect(banner).toBeInTheDocument();
  });

  it('should render CTA button when cta and onClick are provided', () => {
    const handleClick = vi.fn();
    render(
      <WarningBanner isVisible={true} cta="Click Me" onClick={handleClick}>
        Warning message
      </WarningBanner>,
    );
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should call onClick when CTA button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <WarningBanner isVisible={true} cta="Click Me" onClick={handleClick}>
        Warning message
      </WarningBanner>,
    );

    const button = screen.getByRole('button', { name: 'Click Me' });
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not render CTA button when only cta is provided without onClick', () => {
    render(
      <WarningBanner isVisible={true} cta="Click Me">
        Warning message
      </WarningBanner>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should not render CTA button when only onClick is provided without cta', () => {
    const handleClick = vi.fn();
    render(
      <WarningBanner isVisible={true} onClick={handleClick}>
        Warning message
      </WarningBanner>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <WarningBanner isVisible={true} className="custom-class">
        Warning message
      </WarningBanner>,
    );
    const banner = container.querySelector('.custom-class');
    expect(banner).toBeInTheDocument();
  });

  it('should have correct styling classes for visible banner', () => {
    const { container } = render(<WarningBanner isVisible={true}>Warning message</WarningBanner>);
    const banner = container.querySelector('.max-h-28');
    expect(banner).toBeInTheDocument();
  });
});
