import { DiscordIcon, TwitterIcon } from '@hyperlane-xyz/widgets';
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';

type FooterLink = {
  title: string;
  url: string;
  external: boolean;
  icon?: ReactNode;
};

const footerLinks: FooterLink[] = [
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Terms', url: links.tos, external: true },
  { title: 'Twitter', url: links.twitter, external: true, icon: <TwitterIcon color="#6b7280" /> },
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Privacy', url: links.privacyPolicy, external: true },
  { title: 'Discord', url: links.discord, external: true, icon: <DiscordIcon color="#6b7280" /> },
];

export function Footer() {
  return (
    <footer className="relative text-white">
      <div className="relative bg-gradient-to-b from-transparent to-black/40 px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col items-center justify-end gap-8 sm:flex-row sm:gap-10">
          <FooterNav />
        </div>
      </div>
    </footer>
  );
}

function FooterNav() {
  return (
    <nav className="text-md font-medium text-gray-500">
      <ul style={{ gridTemplateColumns: 'auto auto auto' }} className="grid gap-x-7 gap-y-1.5">
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
