export function TipCard() {
  return (
    <div className="relative px-3 py-3 w-100 sm:w-[31rem] bg-red-500 shadow-lg rounded opacity-95">
      <h2 className="text-white sm:text-lg"> ⚠️ Nautilus Chain is shutting down September 6</h2>
      <div className="flex items-end justify-between">
        <p className="text-white mt-1.5 text-xs sm:text-sm">
          You must move your funds from Nautilus Chain to BSC or Solana, otherwise the funds will be
          lost.
        </p>
      </div>
    </div>
  );
}
