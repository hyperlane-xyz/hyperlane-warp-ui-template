type TokenClass = typeof import('@hyperlane-xyz/sdk/token/Token').Token;

let tokenPromise: Promise<TokenClass> | undefined;

export function getSdkToken(): Promise<TokenClass> {
  tokenPromise ??= import('@hyperlane-xyz/sdk/token/Token')
    .then(({ Token }) => Token)
    .catch((error) => {
      tokenPromise = undefined;
      throw error;
    });
  return tokenPromise;
}
