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
    storedTheme = window.localStorage.getItem('warp-ui-theme');
  } catch {
    // Ignore read errors (e.g. privacy mode) and fallback to system theme.
  }

  const themeMode = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : getSystemTheme();
  document.documentElement.dataset.themeMode = themeMode;
})();
