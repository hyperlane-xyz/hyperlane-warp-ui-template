import type { NextPage } from 'next';

import { HomeView } from '../components/layout/HomeView';

// Catch-all: serves /, /bridge, /swap — all render the unified transfer form.
const Home: NextPage = () => {
  return <HomeView />;
};

export default Home;
