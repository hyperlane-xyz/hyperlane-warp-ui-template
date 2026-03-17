import { useEffect, useRef } from 'react';
import { createWarpWidget } from './index.js';
import type { WarpWidgetConfig, WarpWidgetEvent } from './types.js';

export type {
  WarpWidgetConfig,
  WarpWidgetDefaults,
  WarpWidgetEvent,
  WarpWidgetTheme,
} from './types.js';

interface HyperlaneWarpWidgetProps {
  /** Widget configuration (theme, defaults, routes) */
  config?: WarpWidgetConfig;
  /** Called when the widget emits an event */
  onEvent?: (event: WarpWidgetEvent) => void;
  /** Iframe width (default: '100%') */
  width?: string;
  /** Iframe height (default: '600px') */
  height?: string;
  /** CSS class name for the container div */
  className?: string;
  /** Inline styles for the container div */
  style?: React.CSSProperties;
}

/**
 * React component that renders the Hyperlane Warp bridge widget.
 *
 * @example
 * ```tsx
 * <HyperlaneWarpWidget
 *   config={{
 *     theme: { accent: '3b82f6', mode: 'dark' },
 *     routes: ['USDC/arbitrum-ethereum'],
 *   }}
 *   onEvent={(e) => console.log(e)}
 * />
 * ```
 */
export function HyperlaneWarpWidget({
  config,
  onEvent,
  width,
  height,
  className,
  style,
}: HyperlaneWarpWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Serialize config for stable dependency comparison
  const configKey = JSON.stringify(config ?? {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const widget = createWarpWidget({ container, config, width, height });

    const unsubReady = widget.on('ready', (payload) => {
      onEventRef.current?.({ type: 'ready', payload });
    });

    return () => {
      unsubReady();
      widget.destroy();
    };
  }, [configKey, width, height]);

  return <div ref={containerRef} className={className} style={style} />;
}
