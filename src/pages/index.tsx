import type { NextPage } from 'next';
import Image from 'next/image';
import { useState } from 'react';

import { IconButton } from '../components/buttons/IconButton';
import { Card } from '../components/layout/Card';
import { links } from '../consts/links';
import InfoCircle from '../images/icons/info-circle.svg';
import XCircle from '../images/icons/x-circle.svg';

const Home: NextPage = () => {
  return (
    <div>
      <InfoCard />
      <Card classes="w-144 mt-6">Hi!</Card>
    </div>
  );
};

function InfoCard() {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div className="relative p-4 w-144 bg-blue-500 shadow rounded opacity-95">
      <h2 className="text-white text-lg">Bridge Tokens Permissionlessly with Hyperlane!</h2>
      <div className="flex items-end justify-between">
        <p className="text-white mt-1.5 text-sm max-w-[70%]">
          Send tokens across chains or make tokens interchain-ready with just a few clicks. Use
          custom security rules to keep funds safe.
        </p>
        <a
          href={links.docs}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 px-3 py-1.5 flex items-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-sm text-blue-500 rounded-md"
        >
          <Image src={InfoCircle} width={16} alt="" />
          <span className="ml-2">Learn More</span>
        </a>
      </div>
      <div className="absolute right-3 top-3 invert">
        <IconButton imgSrc={XCircle} onClick={() => setShow(false)} title="Hide tip" />
      </div>
    </div>
  );
}

export default Home;
