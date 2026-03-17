# @hyperlane-xyz/warp-widget

Embed the [Hyperlane Warp](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes) bridge widget in any web app. This package wraps the hosted Warp UI in an iframe with a simple API for configuration and event handling.

## Installation

```bash
pnpm add @hyperlane-xyz/warp-widget
# or
npm install @hyperlane-xyz/warp-widget
```

## React Usage

```tsx
import { HyperlaneWarpWidget } from '@hyperlane-xyz/warp-widget/react';

function App() {
  return (
    <HyperlaneWarpWidget
      config={{
        theme: { accent: '3b82f6', mode: 'dark' },
        defaults: { origin: 'ethereum', destination: 'arbitrum' },
        routes: ['USDC/arbitrum-ethereum'],
      }}
      onEvent={(event) => console.log('Widget event:', event)}
      width="420px"
      height="600px"
    />
  );
}
```

## Vanilla JS Usage

```ts
import { createWarpWidget } from '@hyperlane-xyz/warp-widget';

const widget = createWarpWidget({
  container: document.getElementById('widget-root'),
  config: {
    theme: { accent: '3b82f6', mode: 'dark' },
    defaults: { origin: 'ethereum', destination: 'base' },
  },
});

widget.on('ready', (payload) => {
  console.log('Widget ready at', payload.timestamp);
});

// Cleanup
widget.destroy();
```

## Configuration

### Theme

Customize the widget appearance. All color values are hex without `#`.

| Property | Description | Default |
|---|---|---|
| `accent` | Primary color (buttons, headers, links) | `9a0dff` |
| `bg` | Background color | transparent |
| `card` | Card/surface background | `ffffff` |
| `text` | Text color | `010101` |
| `buttonText` | Button text color | `ffffff` |
| `border` | Border color | `bfbfbf40` |
| `error` | Error state color | `dc2626` |
| `mode` | `'dark'` or `'light'` — applies preset defaults | `light` |

### Defaults

Pre-select transfer parameters:

| Property | Description |
|---|---|
| `origin` | Origin chain name (e.g. `'ethereum'`) |
| `destination` | Destination chain name (e.g. `'arbitrum'`) |
| `originToken` | Origin token symbol (e.g. `'USDC'`) |
| `destinationToken` | Destination token symbol |

### Routes

Restrict which warp routes are available:

```ts
config: {
  routes: ['ETH/ethereum-arbitrum', 'USDC/ethereum-base'],
}
```

If omitted, all routes from the nexus registry are shown.

## Events

The widget emits events via `postMessage`. Listen with `onEvent` (React) or `widget.on()` (vanilla JS).

| Event | Payload | Description |
|---|---|---|
| `ready` | `{ timestamp }` | Widget loaded and rendered |

## API Reference

### `createWarpWidget(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `container` | `HTMLElement` | required | DOM element to mount into |
| `config` | `WarpWidgetConfig` | `undefined` | Theme, defaults, and routes |
| `width` | `string` | `'100%'` | Iframe width |
| `height` | `string` | `'600px'` | Iframe height |

Returns `{ iframe, destroy, on }`.

### `<HyperlaneWarpWidget>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `config` | `WarpWidgetConfig` | `undefined` | Theme, defaults, and routes |
| `onEvent` | `(event) => void` | `undefined` | Event callback |
| `width` | `string` | `'100%'` | Iframe width |
| `height` | `string` | `'600px'` | Iframe height |
| `className` | `string` | `undefined` | Container CSS class |
| `style` | `CSSProperties` | `undefined` | Container inline styles |

## License

Apache-2.0
