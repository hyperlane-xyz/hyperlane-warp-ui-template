import { HyperlaneLogo, TwitterIcon } from '@hyperlane-xyz/widgets';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';

type FooterLink = {
  title: string;
  url: string;
  external: boolean;
  icon?: ReactNode;
};

const footerLinks: FooterLink[] = [
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Explorer', url: links.explorer, external: true },
  { title: 'Terms', url: links.tos, external: true },
  { title: 'Privacy', url: links.privacyPolicy, external: true },
  { title: 'Blog', url: links.blog, external: true },
  { title: 'Twitter', url: links.twitter, external: true, icon: <TwitterIcon color="#fff" /> },
];

export function Footer() {
  return (
    <footer className="relative text-white">
      <div className="relative bg-gradient-to-b from-transparent to-black/40 px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:gap-10">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="ml-6 flex items-center justify-center gap-1.5 text-xs font-medium xs:text-md sm:text-xs md:text-base lg:text-xl">
      <span>Built with</span>
      <Image src="/logos/celo.svg" alt="" width={18} height={18} />
      <span>Celo,</span>
      <Image src="/logos/chainlink.svg" alt="" width={18} height={18} />
      <span>Chainlink and</span>
      <HyperlaneLogo color={Color.white} width={18} height={18} />
      <span>Hyperlane</span>
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="text-md font-medium sm:text-xs md:text-md">
      <ul className="grid grid-flow-col grid-rows-3 gap-x-7 gap-y-1.5">
        {footerLinks.map((item) => (
          <li key={item.title}>
            <Link
              className="flex items-center capitalize underline-offset-2 hover:underline"
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              {item?.icon && <div className="mr-3 mt-1 w-4">{item?.icon}</div>}
              {!item?.icon && <div>{item.title}</div>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
