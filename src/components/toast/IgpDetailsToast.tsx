import { toast } from 'react-toastify';

import { links } from '../../consts/links';

export function toastIgpDetails(igpFee: number, tokenName = 'native token') {
  toast.error(<IgpDetailsToast tokenName={tokenName} igpFee={igpFee} />, {
    autoClose: 5000,
  });
}

export function IgpDetailsToast({ tokenName, igpFee }) {
  return (
    <div>
      Cross-chain transfers require a small fee of {igpFee} {tokenName} to fund delivery transaction
      costs. Your {tokenName} balance is insufficient. Try bridging {igpFee} fewer {tokenName}.{' '}
      <a className="underline" href={links.gasDocs} target="_blank" rel="noopener noreferrer">
        Learn More
      </a>
    </div>
  );
}
