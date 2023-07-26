import { useState } from 'react';

export function SideBarMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(true);

  const handleToggleMenu = () => {
    setIsMenuOpen((prevState) => !prevState);
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <button
        className="fixed right-4 top-4 px-4 py-2 bg-blue-500 text-white rounded shadow"
        onClick={handleToggleMenu}
      >
        {'Open'}
      </button>
      <>
        <div
          className={`fixed right-0 top-0 h-full w-64 bg-white shadow-lg transition-opacity transform ease-in duration-300 transition-transform ${
            isMenuOpen ? 'opacity-100 translate-x-0 z-10' : 'opacity-0 translate-x-full z-0'
          }`}
        >
          <button
            className="absolute -translate-x-full left-0 top-0 h-full w-20 bg-red-500 text-white rounded-tr rounded-br shadow"
            onClick={handleCloseMenu}
          ></button>
          <ul>
            <li>Menu item 1</li>
            <li>Menu item 2</li>
          </ul>
        </div>
      </>
    </>
  );
}
