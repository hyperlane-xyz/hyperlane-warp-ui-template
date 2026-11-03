<<<<<<< HEAD
import {
  DiscordIcon,
  DocsIcon,
  GithubIcon,
  HyperlaneLogo,
  TwitterIcon,
} from '@hyperlane-xyz/widgets';
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
];

export function Footer() {
  return (
    <footer className="relative">
      <div className="relative px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-end justify-between gap-8 sm:flex-row sm:gap-10">
=======
import { HyperlaneGradientLogo } from '../icons/HyperlaneGradientLogo';
import { NavItem, navLinks } from './Nav';

export function Footer() {
  return (
    <footer className="footer-root relative text-white">
      <div className="footer-inner relative px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-between gap-4">
>>>>>>> origin/main
          <FooterLogo />
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterLogo() {
  return (
<<<<<<< HEAD
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
=======
    <div className="flex items-center justify-center rounded-full border border-transparent bg-transparent px-[0.8rem] py-[0.35rem] dark:border-primary-300/40 dark:bg-white/[0.08] dark:shadow-[0_0_22px_rgba(154,13,255,0.24)]">
      <HyperlaneGradientLogo
        className="dark:[filter:saturate(1.2)_brightness(1.2)_drop-shadow(0_0_10px_rgba(185,89,255,0.45))]"
        width={219}
        height={18}
      />
>>>>>>> origin/main
    </div>
  );
}

function FooterNav() {
  return (
<<<<<<< HEAD
    <nav className="text-sm">
      <ul
        style={{ gridTemplateColumns: 'auto auto auto auto', gridAutoFlow: 'column' }}
        className="grid grid-rows-2 gap-x-3 gap-y-1.5"
      >
        {footerLinks.map((item) => (
=======
    <nav className="hidden text-md font-medium lg:block">
      <ul className="flex gap-9">
        {navLinks.map((item) => (
>>>>>>> origin/main
          <li key={item.title}>
            <NavItem item={item} className="dark:text-primary-50 dark:hover:text-white" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
