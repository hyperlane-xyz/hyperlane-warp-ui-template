(() => {
  const getSystemTheme = () => {
    try {
      if (typeof window.matchMedia !== 'function') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  };

  let storedTheme = null;
  try {
    // Must match UI_THEME_STORAGE_KEY in src/consts/app.ts.
    // This script runs before TS modules load, so keep this literal in sync manually.
    storedTheme = window.localStorage.getItem('warp-ui-theme');
  } catch {
    // Ignore read errors (e.g. privacy mode) and fallback to system theme.
  }

  const themeMode = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : getSystemTheme();
  document.documentElement.dataset.themeMode = themeMode;
})();
