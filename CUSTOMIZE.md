# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Token Configs

This app requires a token config list to function. The token list is located in `./src/consts/`. Tokens can be configured using any of the token files there (`.ts`, `.json`, `.yaml`). The output token artifacts of a warp route deployment using the [Hyperlane CLI](https://www.npmjs.com/package/@hyperlane-xyz/cli) can be used here.

## Chain Configs

By default, the app will use only the chains that are included in the Hyperlane SDK and connected to the tokens you specify in the token list (see above).

To add support for additional chains, or to modify the default properties of the SDK's chains (such as RPC URLs), add the required chain metadata to any of the chains files in `./src/consts/` (`.ts`, `.json`, `.yaml`). The same chain configs used in the [Hyperlane CLI](https://www.npmjs.com/package/@hyperlane-xyz/cli) will work here. You may also add an optional `logoURI` field to a chain config to show a custom logo image in the app.

## Tip Card

The content of the tip card above the form can be customized in `./src/components/tip/TipCard.tsx`
Or it can be hidden entirely with the `showTipBox` setting in `./src/consts/config.ts`

## Branding

## App name

The values to describe the app itself (e.g. to WalletConnect) are in `./src/consts/app.ts`

### Metadata

The HTML metadata tags are located in `./src/pages/_document.tsx`

### Title / Name Images

The logo images you should change are:

- `./src/images/logos/app-logo.svg`
- `./src/images/logos/app-name.svg`
- `./src/images/logos/app-title.svg`

These are images are primarily used in the header and footer files:

- `./src/components/nav/Header.tsx`
- `./src/components/nav/Footer.tsx`

### Social links

The links used in the footer can be found here: `./src/consts/links.ts`

### Public assets / Favicons

The images and manifest files under `./public` should also be updated.

### Fonts

The web-formatted font files are located in `./public/fonts`
And the CSS to configure them is in `./src/styles/fonts.css`

### Color Scheme

To update the color scheme, make changes in the Tailwind config and Color consts file:

- `./tailwind.config.js`
- `./src/styles/Color.ts`
