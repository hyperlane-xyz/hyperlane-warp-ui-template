import type { NextPage } from 'next';

import { HomeView } from '../components/layout/HomeView';

// Optional catch-all: serves /, /bridge, /swap from one unified page.
const Home: NextPage = () => {
  return <HomeView />;
};

export default Home;
