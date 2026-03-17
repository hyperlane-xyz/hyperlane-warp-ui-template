export interface WarpWidgetTheme {
  /** Primary accent color (hex without #, e.g. "3b82f6") */
  accent?: string;
  /** Background color */
  bg?: string;
  /** Card/surface background */
  card?: string;
  /** Text color */
  text?: string;
  /** Button text color */
  buttonText?: string;
  /** Border color */
  border?: string;
  /** Error state color */
  error?: string;
  /** Color mode preset */
  mode?: 'dark' | 'light';
}

export interface WarpWidgetDefaults {
  /** Origin chain name */
  origin?: string;
  /** Destination chain name */
  destination?: string;
  /** Origin token symbol */
  originToken?: string;
  /** Destination token symbol */
  destinationToken?: string;
}

export interface WarpWidgetConfig {
  /** Theme customization */
  theme?: WarpWidgetTheme;
  /** Pre-selected transfer defaults */
  defaults?: WarpWidgetDefaults;
  /** Warp route IDs to show (e.g. ['ETH/ethereum-arbitrum']). If omitted, shows all routes. */
  routes?: string[];
}

export interface WarpWidgetOptions {
  /** DOM element to mount the iframe into */
  container: HTMLElement;
  /** Widget configuration */
  config?: WarpWidgetConfig;
  /** Iframe width (default: '100%') */
  width?: string;
  /** Iframe height (default: '600px') */
  height?: string;
}

export interface WarpWidgetInstance {
  /** The iframe element */
  iframe: HTMLIFrameElement;
  /** Remove the iframe and clean up event listeners */
  destroy: () => void;
  /** Subscribe to widget events. Returns an unsubscribe function. */
  on: (event: string, cb: (payload?: Record<string, unknown>) => void) => () => void;
}

export interface WarpWidgetEvent {
  type: string;
  payload?: Record<string, unknown>;
}
