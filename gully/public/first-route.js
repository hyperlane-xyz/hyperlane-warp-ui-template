// Runs before first paint, as a file because the site CSP allows no inline script.
(function(d,l){if((l.pathname!=='/'&&l.pathname!=='/index.html')||/[?&](embed|preview|design)/.test(l.search))d.classList.add('gb-spa')})(document.documentElement,location)
