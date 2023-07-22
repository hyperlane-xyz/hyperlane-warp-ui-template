# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Token Configs

This app requires a token config list to function. The token list is located at `./src/consts/tokens.ts`. The output token artifacts of a warp route deployment using the [Hyperlane-Deploy](https://docs.hyperlane.xyz/docs/deploy/deploy-hyperlane) tools can be used here.

## Chain Configs

By default, the app will use only the chains that are included in the Hyperlane SDK and connected to the tokens you specify in the token list (see above).

To add support for additional chains, or to modify the default properties of the SDK's chains (such as RPC URL), add the required chain metadata to `./src/consts/chains.ts`. The same chain config used in the [Hyperlane-Deploy](https://docs.hyperlane.xyz/docs/deploy/deploy-hyperlane) tools will work here. You may also add an optional `logoURI` field to a chain config to show a custom logo image in the app.

## Tip Card

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
