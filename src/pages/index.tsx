import type { NextPage } from 'next';

const Home: NextPage = () => {
  return (
    <div className="relative px-3 py-3 w-100 sm:w-[31rem] shadow-lg rounded bg-white opacity-95">
      <div className="flex flex-col items-center gap-4 py-6">
        <h1 className="mt-1.5 text-md sm:text-lg">Nautilus chain has shutdown.</h1>
        <p className="mt-1.5 text-sm sm:text-md">
          Please see the announcement in this{' '}
          <a
            href="https://x.com/nautilus_chain/status/1829545408034656548"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 text-sm sm:text-md text-blue-500"
          >
            tweet.
          </a>
        </p>
        <p className="mt-1.5 text-sm sm:text-md text-left">
          Need help? Email{' '}
          <a
            href="mailto:nautilus@hyperlane.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 text-sm sm:text-md text-blue-500"
          >
            nautilus@hyperlane.xyz
          </a>{' '}
          for assistance.
        </p>
      </div>
    </div>
  );
};

export default Home;
