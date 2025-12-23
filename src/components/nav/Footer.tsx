import { DiscordIcon, GithubIcon } from '@hyperlane-xyz/widgets';
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { BookIcon } from '../icons/BookIcon';
import { HyperlaneFooterLogo } from '../icons/HyperlaneGradientLogo';
import { StakeIcon } from '../icons/StakeIcon';
import { WebSimpleIcon } from '../icons/WebSimpleIcon';
import { XIcon } from '../icons/XIcon';

type FooterLink = {
  title: string;
  url: string;
  external: boolean;
  icon?: ReactNode;
};

const footerLinks: FooterLink[] = [
  { title: 'Stake', url: links.stake, external: true, icon: <StakeIcon width={20} height={20} /> },
  { title: 'X.com', url: links.twitter, external: true, icon: <XIcon width={19} height={17} /> },
  {
    title: 'Hyperlane',
    url: links.home,
    external: true,
    icon: <WebSimpleIcon width={20} height={20} />,
  },
  {
    title: 'Discord',
    url: links.discord,
    external: true,
    icon: <DiscordIcon color={Color.primary[500]} width={20} height={20} />,
  },
  {
    title: 'Docs',
    url: links.docs,
    external: true,
    icon: <BookIcon color={Color.primary[500]} width={23} height={16} />,
  },
  {
    title: 'Github',
    url: links.github,
    external: true,
    icon: <GithubIcon width={20} height={20} color={Color.primary[500]} />,
  },
];

export function Footer() {
  return (
    <footer className="relative text-white">
      <div className="relative bg-gradient-to-b from-transparent to-black/40 px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-between gap-4">
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="flex items-center justify-center">
      <HyperlaneFooterLogo width={219} height={18} />
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="text-md font-medium">
      <ul className="flex gap-9">
        {footerLinks.map((item) => (
          <li key={item.title}>
            <Link
              className="flex items-center gap-2 decoration-primary-500 underline-offset-2 hover:underline"
              target={item.external ? '_blank' : '_self'}
              href={item.url}
            >
              {item?.icon && <div className="w-4">{item.icon}</div>}
              <span className="text-primary-500">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
