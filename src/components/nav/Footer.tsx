import Image from 'next/image';
import Link from 'next/link';

import { links } from '../../consts/links';
import { Discord } from '../icons/Discord';
import { Github } from '../icons/Github';
import { Medium } from '../icons/Medium';
import { Twitter } from '../icons/Twitter';

const footerLinks1 = [
  { title: 'Docs', url: links.docs, external: true },
  { title: 'Homepage', url: links.home, external: true },
  { title: 'Explorer', url: links.explorer, external: true },
  { title: 'Terms', url: links.terms, external: true },
];

const footerLinks3 = [
  { title: 'Twitter', url: links.twitter, external: true, icon: <Twitter fill="#000" /> },
  { title: 'Discord', url: links.discord, external: true, icon: <Discord fill="#000" /> },
  { title: 'Github', url: links.github, external: true, icon: <Github fill="#000" /> },
  { title: 'Blog', url: links.blog, external: true, icon: <Medium fill="#000" /> },
];

export function Footer() {
  return (
    <footer className="relative">
      <div className="relative z-10 px-8 pb-5 pt-2 sm:pt-0">
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-10 items-center justify-between">
          <div className="flex items-center justify-center">
            <div className="text-lg sm:text-xl font-medium ml-6 space-y-1 ">
              <div className="flex items-center font-medium space-x-1">
                <span>Built with</span>
                <Image src="/logos/everclear.png" alt="" width={130} height={18} />
                <span> and </span>
                <Image src="/logos/renzo.svg" alt="" width={24} height={18} />
                <span>Renzo</span>
              </div>
            </div>
          </div>
          <nav className="flex text-md font-medium">
            <ul className={`${styles.linkCol} mr-14`}>
              {footerLinks1.map((item) => (
                <li className="" key={item.title}>
                  <Link
                    className={styles.linkItem}
                    target={item.external ? '_blank' : '_self'}
                    href={item.url}
                  >
                    <div className="">{item.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className={`${styles.linkCol}`}>
              {footerLinks3.map((item) => (
                <li key={item.title}>
                  <Link
                    className={styles.linkItem}
                    target={item.external ? '_blank' : '_self'}
                    href={item.url}
                  >
                    {item?.icon && <div className="mr-4 w-6">{item?.icon}</div>}
                    <div className="">{item.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  linkCol: 'flex flex-col gap-1.5',
  linkItem: 'flex items-center capitalize text-decoration-none hover:underline underline-offset-2',
};
