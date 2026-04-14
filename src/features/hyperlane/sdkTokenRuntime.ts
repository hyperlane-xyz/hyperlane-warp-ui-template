type TokenClass = typeof import('@hyperlane-xyz/sdk/token/Token').Token;

let tokenPromise: Promise<TokenClass> | undefined;

export function getSdkToken(): Promise<TokenClass> {
  // Cache the lazy import, but clear it on rejection so transient failures can retry.
  tokenPromise ??= import('@hyperlane-xyz/sdk/token/Token')
    .then(({ Token }) => Token)
    .catch((error) => {
      tokenPromise = undefined;
      throw error;
    });
  return tokenPromise;
}
