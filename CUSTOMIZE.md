# Customizing tokens and branding

Find below instructions for customizing the token list and branding assets of this app.

## Token List

This app requires a token list to function. The token list is located at `./src/consts/tokens.json`

The list should use the [Uniswap Token List](https://tokenlists.org) standard with one exception. The tokens must each also include a `hypCollateralAddress` value with the address of the desired hypCollateralERC20 contract.

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
