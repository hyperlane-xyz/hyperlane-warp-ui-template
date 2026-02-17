'use client';

import React, { type ReactNode, type CSSProperties } from 'react';
import { TextMorph } from 'torph/react';

class TextMorphErrorBoundary extends React.Component<
  { children: ReactNode; fallbackText: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallbackText: string }) {
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

  render() {
    if (this.state.hasError) {
      return <span>{this.props.fallbackText}</span>;
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
    <TextMorphErrorBoundary fallbackText={textContent}>
      <TextMorph
        as={as}
        className={className}
        style={style}
        duration={duration}
      >
        {textContent}
      </TextMorph>
    </TextMorphErrorBoundary>
  );
}
