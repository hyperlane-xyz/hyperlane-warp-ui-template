import Image from 'next/image';
import Container from './assets/container.svg';
import MidlImg from './assets/midl.svg';

export function HowItWorks() {
  return (
    <div className="mx-auto flex w-full max-w-[585px] flex-col items-center gap-4 pb-0 pt-10 px-0">
      <h2 className="w-full text-center text-[32px] font-bold leading-normal text-[#202020]">
        How it works?
      </h2>

      {/* Hyperlane handles Bridging */}
      <div className="flex w-full gap-6 overflow-clip rounded-3xl bg-[#ebe4ff] p-6">
        <div className="flex w-[280px] shrink-0 flex-col gap-2 justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-semibold leading-normal text-[#202020]">
                Hyperlane handles Bridging
              </h3>
              <div className="flex flex-col gap-4 text-base font-medium text-[#646464] pl-2.5">
                <p className="leading-normal">EVM, Solana router with:</p>
                <ul className="list-inside list-disc">
                  <li>Dec. validatorship</li>
                  <li>Flexibility</li>
                  <li>Opensource</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2.5">
            <p className="text-[32px] font-bold leading-normal text-[#6e56cf]">
              +10B{' '}
              <span className="text-xl font-medium">Bridged Volume</span>
            </p>
          </div>
        </div>

        {/* Diagram */}
        <div className="relative flex w-[232px] h-[232px] shrink-0 flex-wrap content-start gap-8">
          <Image src={Container} alt='blocks' />
        </div>
      </div>

      {/* Midl handles Runes */}
      <div className="flex w-full gap-6 overflow-clip rounded-3xl bg-[#ebe4ff] px-6 py-[33px]">
        {/* Runes Network Diagram */}
        <div className="relative h-[203px] w-[202px] shrink-0 overflow-clip">
       <Image src={MidlImg} alt='midl' />
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-4">
              <h3 className="w-full text-right text-xl font-semibold leading-normal text-[#202020]">
                Midl handles Runes
              </h3>
              <div className="flex flex-col gap-4">
                <div className="w-full text-right text-base font-medium text-[#646464]">
                  <p className="mb-[14px]">
                    Powerfull Bitcoin execution layer, unlocks native Bitcoin
                    dApps.
                  </p>
                  <p>Enables runes usage at:</p>
                </div>
                <div className="flex flex-wrap content-start items-start justify-end gap-2">
                  <div className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-2 py-1">
                    <p className="text-base font-medium leading-normal text-[#202020]">
                      Lending
                    </p>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M5 11L11 5M11 5H7M11 5V9"
                        stroke="#8e8c99"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-2 py-1">
                    <p className="text-base font-medium leading-normal text-[#202020]">
                      Trading
                    </p>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M5 11L11 5M11 5H7M11 5V9"
                        stroke="#8e8c99"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="relative flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#f9f9f9] px-2 py-1">
                    <p className="text-base font-medium leading-normal text-[#202020]">
                      Many more
                    </p>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M5 11L11 5M11 5H7M11 5V9"
                        stroke="#8e8c99"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
