# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Token List

This app requires a token list to function. The token list is located at `./src/consts/tokens.ts`. The output of a warp route deployment using the [Hyperlane-Deploy](https://docs.hyperlane.xyz/docs/deploy/deploy-hyperlane) tools will work here.

## Permissionless Chain Support

_This section is only relevant if you want to include chains not already supported by Hyperlane._

By default, the app will use only the chains that are included in the Hyperlane SDK and connected to the tokens you specify in the token list (see above).

To add support for additional chains, fill in the required chain metadata in `./src/consts/chains.ts`. You can also use this file to override any default chain configs set in the SDK. The chains config using in the [Hyperlane-Deploy](https://docs.hyperlane.xyz/docs/deploy/deploy-hyperlane) tools will work here. You may also add an optional `logoURI` field to the each chain config.

## RPC Providers

By default, the app uses public RPC providers based on the Hyperlane SDK's default settings.
This can be changed in '`./src/features/providers.ts`.

## Tip Card Content

The content of the tip card above the form can be customized in `./src/components/tip/TipCard.tsx`
Or it can be hidden entirely with the `showTipBox` setting in `./src/consts/config.ts`

## Branding

### Metadata

The HTML metadata tags are located in `./src/pages/_document.tsx`

### Title / Name Images

The logo images you should change are:

- `./src/images/logos/app-logo.svg`
- `./src/images/logos/app-name.svg`
- `./src/images/logos/app-title.png`

These are images are primarily used in the header and footer files:

- `./src/components/nav/Header.tsx`
- `./src/components/nav/Footer.tsx`

### Social links

The links used in the footer can be found here: `./src/consts/links.ts`

### Public assets / Favicons

The images and manifest files under `./public` should also be updated.
The current collection was generated with [RealFaviconGenerator](https://realfavicongenerator.net)

### Fonts

The web-formatted font files are located in `./public/fonts`
And the CSS to configure them is in `./src/styles/fonts.css`

### Color Scheme

To update the color scheme, make changes in the Tailwind config and Color consts file:

- `./tailwind.config.js`
- `./src/styles/Color.ts`
