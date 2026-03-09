import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createWarpIframe } from './iframe.js';

function stableSerialize(value) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

export function HyperlaneWarpWidget({ iframeUrl, config, onEvent, className, style }) {
  const containerRef = useRef(null);
  const onEventRef = useRef(onEvent);
  const [isReady, setIsReady] = useState(false);
  const configKey = useMemo(() => stableSerialize(config), [config]);
  const parsedConfig = useMemo(() => {
    try {
      return JSON.parse(configKey);
    } catch {
      return {};
    }
  }, [configKey]);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const instance = createWarpIframe(container, {
      iframeUrl: iframeUrl || 'http://localhost:3000/embed',
      config: parsedConfig,
      onEvent: (event) => {
        if (event.type === 'ready') setIsReady(true);
        onEventRef.current?.(event);
      },
    });

    return () => instance.destroy();
  }, [configKey, iframeUrl, parsedConfig]);

  return (
    <div data-testid="warp-widget-root" className={className} style={style}>
      {isReady && <span data-testid="warp-widget-ready" style={{ display: 'none' }} />}
      <div ref={containerRef} />
    </div>
  );
}

export { createWarpIframe } from './iframe.js';
