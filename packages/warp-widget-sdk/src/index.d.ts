import * as React from 'react';

export type WarpWidgetEvent = {
  type: string;
  payload?: Record<string, unknown>;
};

export type WarpWidgetConfig = Record<string, unknown>;

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
