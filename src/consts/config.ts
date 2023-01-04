const isDevMode = process?.env?.NODE_ENV === 'development';
const version = process?.env?.NEXT_PUBLIC_VERSION ?? null;
const explorerApiKeys = JSON.parse(process?.env?.EXPLORER_API_KEYS || '{}');

interface Config {
  debug: boolean;
  version: string | null;
  explorerApiKeys: Record<string, string>;
}

export const config: Config = Object.freeze({
  debug: isDevMode,
  version,
  explorerApiKeys,
});
