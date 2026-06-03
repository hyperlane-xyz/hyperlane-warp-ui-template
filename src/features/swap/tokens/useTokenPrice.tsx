// Engine doesn't expose token USD prices yet. Shape mirrors warp UI's
// useTokenPrices so TokenList consumes it without changes; the price
// map is empty for now.
export function useTokenPrices(): { prices: Record<string, number>; isLoading: boolean } {
  return { prices: {}, isLoading: false };
}
