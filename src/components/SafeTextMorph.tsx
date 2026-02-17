'use client';

import React, { type CSSProperties, type ReactNode } from 'react';
import { TextMorph } from 'torph/react';

type TextMorphErrorBoundaryProps = {
  children: ReactNode;
  fallbackText: string;
  as: keyof JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
};

class TextMorphErrorBoundary extends React.Component<
  TextMorphErrorBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: TextMorphErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('TextMorph error:', error);
  }

  componentDidUpdate(prevProps: TextMorphErrorBoundaryProps) {
    if (
      this.state.hasError &&
      (prevProps.fallbackText !== this.props.fallbackText ||
        prevProps.as !== this.props.as ||
        prevProps.className !== this.props.className ||
        prevProps.style !== this.props.style)
    ) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      const { as: Tag, className, style, fallbackText } = this.props;
      return React.createElement(Tag, { className, style }, fallbackText);
    }
    return this.props.children;
  }
}

interface SafeTextMorphProps {
  children: string | number | boolean | null | undefined;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
  duration?: number;
}

export function SafeTextMorph({
  children,
  as = 'span',
  className,
  style,
  duration,
}: SafeTextMorphProps) {
  const textContent = String(children ?? '');

  return (
    <TextMorphErrorBoundary fallbackText={textContent} as={as} className={className} style={style}>
      <TextMorph as={as} className={className} style={style} duration={duration}>
        {textContent}
      </TextMorph>
    </TextMorphErrorBoundary>
  );
}
