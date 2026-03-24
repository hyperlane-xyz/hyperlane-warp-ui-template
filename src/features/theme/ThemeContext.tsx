import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { DEFAULT_UI_THEME_MODE, UI_THEME_STORAGE_KEY, UiThemeMode } from '../../consts/app';
import { processDarkLogoImage } from '../../utils/imageBrightness';
import { getSystemUiThemeMode, parseUiThemeMode } from '../../utils/theme';

interface ThemeContextValue {
  themeMode: UiThemeMode;
  toggleThemeMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getStoredThemeMode(): UiThemeMode | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseUiThemeMode(window.localStorage.getItem(UI_THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persistThemeMode(mode: UiThemeMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, mode);
  } catch {
    // Keep theme toggle working for this session when storage is unavailable.
  }
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeMode] = useState<UiThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_UI_THEME_MODE;
    const docTheme = parseUiThemeMode(document.documentElement.dataset.themeMode);
    if (docTheme) return docTheme;
    const storedTheme = getStoredThemeMode();
    return storedTheme ?? getSystemUiThemeMode();
  });
  const [hasExplicitThemePreference, setHasExplicitThemePreference] = useState(() => {
    return getStoredThemeMode() !== null;
  });

  const toggleThemeMode = useCallback(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.themeSwitching = 'true';
    setThemeMode((prevThemeMode) => (prevThemeMode === 'dark' ? 'light' : 'dark'));
    setHasExplicitThemePreference(true);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.themeMode = themeMode;
    if (hasExplicitThemePreference) persistThemeMode(themeMode);
    const knownLogoImages = document.querySelectorAll(
      'img[data-logo-handlers-bound="true"], img[data-logo-original-src], img[data-logo-dark-src]',
    );
    knownLogoImages.forEach((img) => processDarkLogoImage(img as HTMLImageElement));

    const frame = window.requestAnimationFrame(() => {
      delete document.documentElement.dataset.themeSwitching;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [themeMode, hasExplicitThemePreference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasExplicitThemePreference) return;
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setThemeMode(event.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [hasExplicitThemePreference]);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleThemeMode }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
