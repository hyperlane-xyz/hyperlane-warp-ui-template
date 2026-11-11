// The first load: styles only. The page is already in the HTML (scripts/prerender.mjs); React, viem and the wallet code
// arrive in boot.tsx after first paint and take over that HTML.
import './styles/night/tokens.css';
import './styles/base.css';
import './styles/a.css';
import './styles/b.css';
import './styles/c.css';
import './styles/earn.css';
import './styles/night.css';

void import('./boot');
