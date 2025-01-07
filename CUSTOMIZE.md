# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Registry

By default, the app will use the canonical Hyperlane registry published on NPM. See `package.json` for the precise version.

To use custom chains or custom warp routes, you can either configure a different registry using the `NEXT_PUBLIC_REGISTRY_URL` environment variable or define them manually (see the next two sections).

## Custom Warp Route Configs

This app requires a set of warp route configs to function. The configs are located in `./src/consts/warpRoutes.yaml` and `./src/consts/warpRoutes.ts`. The output artifacts of a warp route deployment using the [Hyperlane CLI](https://www.npmjs.com/package/@hyperlane-xyz/cli) can be used here.

In addition to defining your warp route configs, you can control which routes display in the UI via the `warpRouteWhitelist.ts` file.

## Custom Chain Configs

By default, the app will use only the chains that are included in the configured registry and included in your warp routes.

To add support for additional chains, or to override a chain's properties (such as RPC URLs), add chain metadata to either `./src/consts/chains.ts` or `./src/consts/chains.yaml`. The same chain configs used in the [Hyperlane CLI](https://www.npmjs.com/package/@hyperlane-xyz/cli) will work here. You may also add an optional `logoURI` field to a chain config to show a custom logo image in the app.

## Tip Card

The content of the tip card above the form can be customized in `./src/components/tip/TipCard.tsx`
Or it can be hidden entirely with the `showTipBox` setting in `./src/consts/config.ts`

## Branding

## App name and description

The values to describe the app itself (e.g. to WalletConnect) are in `./src/consts/app.ts`

### Color Scheme

To update the color scheme, make changes in the Tailwind config file at `./tailwind.config.js`
To modify just the background color, that can be changed in `./src/consts/app.ts`

### Metadata

The HTML metadata tags are located in `./src/pages/_document.tsx`

### Title / Name Images

The logo images you should change are:

- `./src/images/logos/app-logo.svg`
- `./src/images/logos/app-name.svg`
- `./src/images/logos/app-title.svg`

These images are primarily used in the header and footer files:

- `./src/components/nav/Header.tsx`
- `./src/components/nav/Footer.tsx`

### Social links

The links used in the footer can be found here: `./src/consts/links.ts`

### Public assets / Favicons

The images and manifest files under `./public` should also be updated.
