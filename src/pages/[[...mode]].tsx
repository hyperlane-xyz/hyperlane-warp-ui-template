import type { NextPage } from 'next';
import { useRouter } from 'next/router';

import { HomeView } from '../components/layout/HomeView';
import type { AppMode } from '../components/nav/ModeTabs';

// Optional catch-all: serves /, /bridge, /swap from one page.
// /swap → swap tab; everything else → bridge tab.
const Home: NextPage = () => {
  const router = useRouter();
  const segment = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode;
  const mode: AppMode = segment === 'swap' ? 'swap' : 'bridge';
  return <HomeView mode={mode} />;
};

export default Home;
