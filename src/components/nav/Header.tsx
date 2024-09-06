import Image from 'next/image';
import Link from 'next/link';

import Title from '../../images/logos/app-title.svg';

export function Header() {
  return (
    <header className="pt-3 pb-2 w-full">
      <div className="flex items-start justify-between">
        <Link href="/" className="py-2 flex items-center">
          <Image src={Title} width={185} alt="" className="mt-0.5 ml-2 pb-px" />
        </Link>
      </div>
    </header>
  );
}
