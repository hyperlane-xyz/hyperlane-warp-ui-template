# Hyperlane Warp Route UI Template

This repo contains an example web interface for interchain tokens built with [Hyperlane Warp Route](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes). Warp is a framework to permissionlessly bridge tokens to any chain.

## Architecture

This app is built with Next & React, Wagmi, RainbowKit, and the Hyperlane SDK.

- Constants that you may want to change are in `./src/consts/`, see the following Customization section for details.
- The index page is located at `./src/pages/index.tsx`
- The primary features are implemented in `./src/features/`

## Customization

See [CUSTOMIZE.md](./CUSTOMIZE.md) for details about adjusting the tokens and branding of this app.

## Development

### Setup

#### Configure

You need a `projectId` from the WalletConnect Cloud to run the Hyperlane Warp Route UI. Sign up to [WalletConnect Cloud](https://cloud.walletconnect.com) to create a new project.

#### Build

```sh
# Install dependencies
pnpm install

# Build Next project
pnpm run build
```

### Run

You can add `.env.local` file next to `.env.example` where you set `projectId` copied from WalletConnect Cloud.

```sh
# Start the Next dev server
pnpm run dev
# Or with a custom projectId
NEXT_PUBLIC_WALLET_CONNECT_ID=<projectId> pnpm run dev
```

### Test

```sh
# Run unit tests
pnpm test

# Run E2E tests (reuses running dev server, or starts one via Playwright)
pnpm test:e2e

# Run E2E tests with headed browser and slow motion for debugging
SLOW_MO=2000 pnpm test:e2e --headed --workers=1

# Run a single E2E test file with headed browser
SLOW_MO=2000 pnpm test:e2e --headed --workers=1 tests/wallet-connect/protocol-wallet-modals.spec.ts

# Lint check code
pnpm run lint

# Check code types
pnpm run typecheck
```

### Format

```sh
# Format code using Prettier
pnpm run prettier
```

### Clean / Reset

```sh
# Delete build artifacts to start fresh
pnpm run clean
```

### Local package linking to hyperlane-monorepo

If you have to make changes to the widgets package to edit e.g. the Connect Button or other components linking
the widgets package locally to test it is necessary. To do that you can run the following commands

```sh
# Link monorepo packages with the warp-ui
pnpm link:monorepo
# Unlink packages again after testing
pnpm unlink:monorepo
```

## Embed Widget

The Warp UI can be embedded as an iframe on any website, giving your users a bridge experience directly in your app.

### Setup

Once deployed (e.g., to Vercel), the embed is available at `/embed`:

```html
<iframe
  src="https://your-domain.com/embed"
  width="420"
  height="600"
  style="border: none; border-radius: 12px;"
/>
```

You can pre-select transfer routes using query params:

```
/embed?origin=ethereum&destination=arbitrum&originToken=USDC&destinationToken=USDC
```

### Theme Customization

Customize colors via URL params (hex values without `#`):

| Param        | Description                                    | Default (light) |
| ------------ | ---------------------------------------------- | --------------- |
| `accent`     | Primary/accent color (buttons, headers, links) | `9A0DFF`        |
| `bg`         | Page background                                | transparent     |
| `card`       | Card/surface background                        | `ffffff`        |
| `text`       | Text color                                     | `010101`        |
| `buttonText` | Button text color                              | `ffffff`        |
| `border`     | Border color                                   | `BFBFBF40`      |
| `error`      | Error state color                              | `dc2626`        |
| `mode`       | `dark` or `light` — applies preset defaults    | `light`         |

**Examples:**

```html
<!-- Blue accent -->
<iframe src="https://your-domain.com/embed?accent=3b82f6" ... />

<!-- Dark mode with green accent -->
<iframe src="https://your-domain.com/embed?mode=dark&accent=22c55e" ... />

<!-- Fully custom theme -->
<iframe
  src="https://your-domain.com/embed?bg=0f172a&card=1e293b&text=e2e8f0&accent=8b5cf6&buttonText=ffffff&border=334155"
  ...
/>
```

### PostMessage Events

The embed page sends events to the parent window via `postMessage`:

```js
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'hyperlane-warp-widget') return;

  const { type, payload } = event.data.event;
  if (type === 'ready') {
    console.log('Widget ready at', payload.timestamp);
  }
});
```

### Solving CSP Issues

If your site has a Content Security Policy that blocks iframes, you'll need to allow the Warp UI origin in your CSP `frame-src` directive:

```
Content-Security-Policy: frame-src https://your-warp-ui-domain.com;
```

For sites where you can't modify CSP headers (e.g., WordPress, Shopify), check if the platform has an iframe allowlist setting, or use a reverse proxy to serve the embed from your own domain.

## Deployment

The easiest hosting solution for this Next.JS app is to create a project on Vercel.

## Learn more

For more information, see the [Hyperlane documentation](https://docs.hyperlane.xyz/docs/protocol/warp-routes/warp-routes-overview).
