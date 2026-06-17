import type { NextPage } from 'next';

import { HomeView } from '../components/layout/HomeView';

// Optional catch-all: serves /, /bridge, and /swap with the same engine-owned form.
const Home: NextPage = () => {
  return <HomeView />;
};

export default Home;
