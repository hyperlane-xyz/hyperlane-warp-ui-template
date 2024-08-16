# Hyperlane Warp Route UI Template

This repo contains an example web interface for interchain tokens built with [Hyperlane Warp Route](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes). Warp is a framework to permisionlessly bridge tokens to any chain.

## Architecture

This app is built with Next & React, Wagmi, RainbowKit, and the Hyperlane SDK.

- Constants that you may want to change are in `./src/consts/`, see the following Customization section for details.
- The index page is located at `./src/pages/index.tsx`
- The primary features are implemented in `./src/features/`

## Customization

See [CUSTOMIZE.md](./CUSTOMIZE.md) for details about adjusting the tokens and branding of this app.

## Development

### Setup

#### Build
```sh
# Install dependencies
yarn

# Build Next project
yarn build
```

#### Configure

You need a `projectId` from the WalletConnect Cloud to run the Hyperlane Warp Route UI successfully. 
Sign up to [WalletConnect Cloud](https://cloud.walletconnect.com/), create 
new project with AppKit and Next.js and copy the `projectId` from there.

### Run

You can add `.env.local` file next to `.env.example` where you set `projectId` copied from WalletConnect Cloud.
```sh
# Start the Next dev server
yarn dev
```

Or you can set the WalletConnect Cloud `projectId` to use as follows:
```
NEXT_PUBLIC_WALLET_CONNECT_ID=<projectId> yarn dev
```

### Test

```sh
# Lint check code
yarn lint

# Check code types
yarn typecheck
```

### Format

```sh
# Format code using Prettier
yarn prettier
```

### Clean / Reset

```sh
# Delete build artifacts to start fresh 
yarn clean
```

## Deployment

The easiest hosting solution for this Next.JS app is to create a project on Vercel.

## Learn more

For more information, see the [Hyperlane documentation](https://docs.hyperlane.xyz/docs/reference/applications/warp-routes).
