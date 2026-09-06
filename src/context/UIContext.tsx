import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Language, TranslationKey, translations } from '../i18n/translations';
import { preferences } from '../storage/preferences';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface UIContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatNumber: (val: number, decimals?: number) => string;
  formatDate: (dateStr: string) => string;
  formatTime: (dateStr: string) => string;
}

const UIContext = createContext<UIContextType | null>(null);

const THEME_STORAGE_KEY = 'lesco_theme_mode';
const LANG_STORAGE_KEY = 'lesco_language';

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme state initialization
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = preferences.get(THEME_STORAGE_KEY) as ThemeMode;
    if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    return 'auto';
  });

  // System dark preference detector
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Listen to system theme changes in real time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // Compute effective theme
  const effectiveTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'dark') return 'dark';
    if (theme === 'light') return 'light';
    return systemIsDark ? 'dark' : 'light';
  }, [theme, systemIsDark]);

  // Apply .dark class to documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      preferences.set(THEME_STORAGE_KEY, newTheme);
    } catch { /* Preference adapter handles unavailable storage. */ }
  }, []);

  // Language state initialization
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = preferences.get(LANG_STORAGE_KEY) as Language;
    if (saved === 'en' || saved === 'ur') return saved;
    return 'en';
  });

  const isRTL = language === 'ur';
  const dir: 'ltr' | 'rtl' = isRTL ? 'rtl' : 'ltr';

  // Apply dir and lang to html root element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [dir, language]);

  const setLanguage = useCallback((newLang: Language) => {
    setLanguageState(newLang);
    try {
      preferences.set(LANG_STORAGE_KEY, newLang);
    } catch { /* Preference adapter handles unavailable storage. */ }
  }, []);

  // Translation function with parameter interpolation
  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.en;
      let text = dict[key] || translations.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([paramKey, paramVal]) => {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        });
      }
      return text;
    },
    [language]
  );

  // Accessible, clean numeric formatting
  const formatNumber = useCallback((val: number, decimals: number = 1): string => {
    if (isNaN(val)) return '0.0';
    return val.toFixed(decimals);
  }, []);

  // Formats dates while ensuring underlying timestamps are never mutated
  const formatDate = useCallback(
    (dateStr: string): string => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return dateStr;
      }
    },
    [language]
  );

  const formatTime = useCallback(
    (dateStr: string): string => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleTimeString(language === 'ur' ? 'ur-PK' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return dateStr;
      }
    },
    [language]
  );

  return (
    <UIContext.Provider
      value={{
        theme,
        effectiveTheme,
        setTheme,
        language,
        setLanguage,
        isRTL,
        dir,
        t,
        formatNumber,
        formatDate,
        formatTime,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
