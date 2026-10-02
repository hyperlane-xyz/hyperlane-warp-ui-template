# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Registry And Routes

By default, the app will use the canonical Hyperlane registry published on NPM. See `package.json` for the precise version.

The transfer form is powered by the Universal Router API. Token lists, route availability, quotes, approvals, and executable transactions come from the engine endpoints, not local warp route files.

To use custom chains or custom warp routes, configure the registry used by the Universal Router API. The UI can still use `NEXT_PUBLIC_REGISTRY_URL` and `NEXT_PUBLIC_REGISTRY_BRANCH` for chain metadata and RPC overrides, but route discovery must be available from the engine.

## Custom Chain Configs

By default, the app will use the chains returned by the Universal Router API and resolve their metadata from the configured registry.

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
