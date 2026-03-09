import * as React from 'react';

export type WarpWidgetEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

export type WarpWidgetConfig = {
  theme?: {
    accentColor?: string;
    accentSoft?: string;
    accentTo?: string;
    backgroundColor?: string;
    cardColor?: string;
    textColor?: string;
    borderColor?: string;
    buttonTextColor?: string;
  };
  defaults?: {
    originChain?: string;
    destinationChain?: string;
    originAsset?: string;
    destinationAsset?: string;
    token?: string;
  };
  [key: string]: unknown;
};

export function createWarpIframe(
  container: HTMLElement,
  options: {
    iframeUrl: string;
    config?: WarpWidgetConfig;
    height?: string;
    onEvent?: (event: WarpWidgetEvent) => void;
  },
): {
  iframe: HTMLIFrameElement;
  destroy: () => void;
};

export function HyperlaneWarpWidget(props: {
  iframeUrl?: string;
  config?: WarpWidgetConfig;
  onEvent?: (event: WarpWidgetEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element;
