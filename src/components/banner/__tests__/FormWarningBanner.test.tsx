import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormWarningBanner } from '../FormWarningBanner';

describe('FormWarningBanner', () => {
  it('should render WarningBanner with correct props', () => {
    const { container } = render(
      <FormWarningBanner isVisible={true}>Warning message</FormWarningBanner>,
    );
    expect(container.querySelector('.absolute')).toBeInTheDocument();
  });

  it('should apply custom className to WarningBanner', () => {
    const { container } = render(
      <FormWarningBanner isVisible={true} className="custom-class">
        Warning message
      </FormWarningBanner>,
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render with padding when isVisible is true', () => {
    const { container } = render(
      <FormWarningBanner isVisible={true}>Warning message</FormWarningBanner>,
    );
    expect(container.querySelector('.pb-10')).toBeInTheDocument();
  });

  it('should render without padding when isVisible is false', () => {
    const { container } = render(
      <FormWarningBanner isVisible={false}>Warning message</FormWarningBanner>,
    );
    expect(container.querySelector('.pb-0')).toBeInTheDocument();
  });

  it('should pass through all props to WarningBanner', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <FormWarningBanner isVisible={true} cta="Action" onClick={onClick}>
        Test content
      </FormWarningBanner>,
    );
    expect(getByText('Test content')).toBeInTheDocument();
    expect(getByText('Action')).toBeInTheDocument();
  });
});
