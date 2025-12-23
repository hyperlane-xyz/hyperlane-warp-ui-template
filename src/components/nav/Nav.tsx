import { DiscordIcon, GithubIcon } from '@hyperlane-xyz/widgets';
import clsx from 'clsx';
import Link from 'next/link';
import { ReactNode } from 'react';
import { links } from '../../consts/links';
import { Color } from '../../styles/Color';
import { BookIcon } from '../icons/BookIcon';
import { StakeIcon } from '../icons/StakeIcon';
import { WebSimpleIcon } from '../icons/WebSimpleIcon';
import { XIcon } from '../icons/XIcon';

interface NavLinkItem {
  title: string;
  url: string;
  icon: ReactNode;
}

export const navLinks: NavLinkItem[] = [
  { title: 'Stake', url: links.stake, icon: <StakeIcon width={20} height={20} /> },
  { title: 'X.com', url: links.twitter, icon: <XIcon width={19} height={17} /> },
  { title: 'Hyperlane', url: links.home, icon: <WebSimpleIcon width={20} height={20} /> },
  {
    title: 'Discord',
    url: links.discord,
    icon: <DiscordIcon color={Color.primary[500]} width={20} height={20} />,
  },
  {
    title: 'Docs',
    url: links.docs,
    icon: <BookIcon color={Color.primary[500]} width={23} height={16} />,
  },
  {
    title: 'Github',
    url: links.github,
    icon: <GithubIcon width={20} height={20} color={Color.primary[500]} />,
  },
];

interface NavItemProps {
  item: NavLinkItem;
  className?: string;
}

export function NavItem({ item, className }: NavItemProps) {
  return (
    <Link
      className={clsx(
        'flex items-center gap-2 text-primary-500 decoration-primary-500 underline-offset-2 hover:underline',
        className,
      )}
      target="_blank"
      href={item.url}
    >
      <div className="w-5">{item.icon}</div>
      <span>{item.title}</span>
    </Link>
  );
}
