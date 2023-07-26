import Image from 'next/image';
import { useEffect, useState } from 'react';

import CollapseIcon from '../../images/icons/collapse-icon.svg';

export function SideBarMenu({ isOpen, onClose }: { isOpen: boolean; onClose?: () => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(isOpen);
  }, [isOpen]);

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    onClose?.();
  };

  return (
    <div
      className={`absolute right-0 top-1.5 h-full w-96 bg-white bg-opacity-95 shadow-lg transition-opacity transform ease-in duration-100 transition-transform ${
        isMenuOpen ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-full z-0'
      }`}
    >
      <button
        className="absolute bg-opacity-60 -translate-x-full left-0 top-0 h-full w-10 bg-white rounded-l-md flex items-center justify-center"
        onClick={handleCloseMenu}
      >
        <Image src={CollapseIcon} width={15} height={24} alt="" />
      </button>
      <div className="w-full h-full">
        <div className="w-full rounded-t-md bg-blue-500 pt-3 pb-3 pl-5 pr-5">
          <span className="text-white text-lg font-medium tracking-wider">Connected Wallets</span>
        </div>
        <div className="mb-32"></div>
        <div className="w-full bg-blue-500 pt-3 pb-3 pl-5 pr-5">
          <span className="text-white text-lg font-medium tracking-wider">Transfer History</span>
        </div>
      </div>
    </div>
  );
}
