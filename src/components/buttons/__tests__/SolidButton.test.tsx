import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SolidButton } from '../SolidButton';

describe('SolidButton', () => {
  it('should render with children', () => {
    render(<SolidButton>Click Me</SolidButton>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<SolidButton onClick={handleClick}>Click Me</SolidButton>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render as submit type when specified', () => {
    render(<SolidButton type="submit">Submit</SolidButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should default to button type', () => {
    render(<SolidButton>Default</SolidButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<SolidButton disabled>Disabled Button</SolidButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should not call onClick when disabled', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(
      <SolidButton onClick={handleClick} disabled>
        Disabled
      </SolidButton>,
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply primary color by default', () => {
    const { container } = render(<SolidButton>Primary</SolidButton>);
    const button = container.querySelector('.bg-primary-900');
    expect(button).toBeInTheDocument();
  });

  it('should apply accent color when specified', () => {
    const { container } = render(<SolidButton color="accent">Accent</SolidButton>);
    const button = container.querySelector('.bg-accent-500');
    expect(button).toBeInTheDocument();
  });

  it('should apply green color when specified', () => {
    const { container } = render(<SolidButton color="green">Green</SolidButton>);
    const button = container.querySelector('.bg-green-500');
    expect(button).toBeInTheDocument();
  });

  it('should apply red color when specified', () => {
    const { container } = render(<SolidButton color="red">Red</SolidButton>);
    const button = container.querySelector('.bg-red-600');
    expect(button).toBeInTheDocument();
  });

  it('should apply white color when specified', () => {
    const { container } = render(<SolidButton color="white">White</SolidButton>);
    const button = container.querySelector('.bg-white');
    expect(button).toBeInTheDocument();
  });

  it('should apply gray color when specified', () => {
    const { container } = render(<SolidButton color="gray">Gray</SolidButton>);
    const button = container.querySelector('.bg-gray-100');
    expect(button).toBeInTheDocument();
  });

  it('should apply bold font weight when bold is true', () => {
    const { container } = render(<SolidButton bold>Bold Text</SolidButton>);
    const button = container.querySelector('.font-semibold');
    expect(button).toBeInTheDocument();
  });

  it('should render with icon when provided', () => {
    const icon = <span data-testid="test-icon">🔥</span>;
    render(<SolidButton icon={icon}>With Icon</SolidButton>);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<SolidButton className="custom-class">Custom</SolidButton>);
    const button = container.querySelector('.custom-class');
    expect(button).toBeInTheDocument();
  });

  it('should render title attribute', () => {
    render(<SolidButton title="Button Title">Button</SolidButton>);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Button Title');
  });
});
