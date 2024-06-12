// Copied from https://github.com/WalletConnect/web3modal/pull/614/files
// But updated to use newer packages
import { WindowPostMessageStream } from '@metamask/post-message-stream';
import { initializeProvider } from '@metamask/providers';

// Firefox Metamask Hack
// Due to https://github.com/MetaMask/metamask-extension/issues/3133
(() => {
  if (
    typeof window !== 'undefined' &&
    !window.ethereum &&
    !window.web3 &&
    navigator.userAgent.includes('Firefox')
  ) {
    // setup background connection
    const metamaskStream = new WindowPostMessageStream({
      name: 'metamask-inpage',
      target: 'metamask-contentscript',
    });

    // this will initialize the provider and set it as window.ethereum
    initializeProvider({
      connectionStream: metamaskStream,
      shouldShimWeb3: true,
    });
  }
})();
