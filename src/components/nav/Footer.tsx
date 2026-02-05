<<<<<<< HEAD
import {
  DiscordIcon,
  DocsIcon,
  GithubIcon,
  HyperlaneLogo,
  TwitterIcon,
} from '@hyperlane-xyz/widgets';
import Image from 'next/image';
=======
import { DiscordIcon, GithubIcon, HyperlaneLogo, TwitterIcon } from '@hyperlane-xyz/widgets';
import clsx from 'clsx';
>>>>>>> origin/main
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';
import { INTERCOM_APP_ID } from '../../features/analytics/intercom';
import { Color } from '../../styles/Color';

type FooterLink = {
  title: string;
  url: string;
  external: boolean;
  icon?: ReactNode;
};

const footerLinks: FooterLink[] = [
<<<<<<< HEAD
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Support', url: links.support, external: true },

  { title: 'INJ Explorer', url: links.explorerInj, external: true },
  { title: 'About', url: links.about, external: true },
  { title: 'Docs', url: links.docs, external: true, icon: <DocsIcon color={Color.black} /> },
  {
    title: 'Discord',
    url: links.discord,
    external: true,
    icon: <DiscordIcon color={Color.black} />,
  },
  { title: 'Github', url: links.github, external: true, icon: <GithubIcon color={Color.black} /> },
  {
    title: 'Twitter',
    url: links.twitter,
    external: true,
    icon: <TwitterIcon color={Color.black} />,
  },
=======
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Support', url: links.support, external: true },
  { title: 'Twitter', url: links.twitter, external: true, icon: <TwitterIcon color="#fff" /> },
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Privacy', url: links.privacyPolicy, external: true },
  { title: 'Discord', url: links.discord, external: true, icon: <DiscordIcon color="#fff" /> },
  { title: 'Explorer', url: links.explorer, external: true },
  { title: 'Terms', url: links.tos, external: true },
  { title: 'Github', url: links.github, external: true, icon: <GithubIcon color="#fff" /> },
>>>>>>> origin/main
];

export function Footer() {
  const chatboxExist = !!INTERCOM_APP_ID;
  return (
<<<<<<< HEAD
    <footer className="relative">
      <div className="relative px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-end justify-between gap-8 sm:flex-row sm:gap-10">
          <FooterLogo />
=======
    <footer className="relative text-white">
      <div className="relative bg-gradient-to-b from-transparent to-black/40 px-8 pb-5 pt-2 sm:pt-0">
        <div
          className={clsx(
            'flex flex-col items-center gap-8 sm:flex-row sm:gap-10',
            chatboxExist ? 'justify-start' : 'justify-between',
          )}
        >
          {!chatboxExist && <FooterLogo />}
>>>>>>> origin/main
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
    <div className="flex items-center justify-center space-x-2 py-1">
      <div className="flex items-center space-x-1">
        <span>Built with</span>
        <Link href={links.about} className="flex items-center space-x-1" target="_blank">
          <HyperlaneLogo color={Color.black} width={17} height={17} />
          <span>Hyperlane</span>
        </Link>
        <span>and</span>
        <Link href={links.caldera} className="flex items-center space-x-1" target="_blank">
          <Image src="/logos/caldera.png" alt="" width={24} height={18} />
          <span>Caldera</span>
        </Link>
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <nav className="text-sm">
      <ul
        style={{ gridTemplateColumns: 'auto auto auto auto', gridAutoFlow: 'column' }}
        className="grid grid-rows-2 gap-x-3 gap-y-1.5"
      >
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
