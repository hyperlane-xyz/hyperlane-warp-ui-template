import { toast } from 'react-toastify';

import { links } from '../../consts/links';

export function toastIgpDetails() {
  toast.error(<IgpDetailsToast />, {
    autoClose: 5000,
  });
}

export function IgpDetailsToast() {
  return (
    <div>
      Cross-chain transfers require a small amount of extra gas to fund delivery. Your native token
      balance is insufficient.{' '}
      <a className="underline" href={links.gasDocs} target="_blank" rel="noopener noreferrer">
        Learn More
      </a>
    </div>
  );
}
