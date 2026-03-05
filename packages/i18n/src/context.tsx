"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  type Locale,
  type I18nContextValue,
  type Translations,
  type TranslationParams,
  DEFAULT_LOCALE,
} from "./types";
import {
  detectBrowserLocale,
  persistLocale,
  interpolate,
  getNestedValue,
} from "./utils";
import { en } from "./locales/en";
import { ro } from "./locales/ro";

const translations: Record<Locale, Translations> = {
  en,
  ro,
};

const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  defaultLocale?: Locale;
}

export function I18nProvider({
  children,
  defaultLocale,
}: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale ?? DEFAULT_LOCALE);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const detected = detectBrowserLocale();
    setLocaleState(detected);
    setIsHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    persistLocale(newLocale);

    // Update HTML lang attribute
    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      const currentTranslations = translations[locale];
      const value = getNestedValue(currentTranslations, key);

      if (value === undefined) {
        // Fallback to English if translation not found
        const fallback = getNestedValue(translations.en, key);
        if (fallback === undefined) {
          console.warn(`Missing translation for key: ${key}`);
          return key;
        }
        return interpolate(fallback, params);
      }

      return interpolate(value, params);
    },
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      translations: translations[locale],
    }),
    [locale, setLocale, t]
  );

  // Prevent hydration mismatch by rendering with default locale on server
  if (!isHydrated) {
    const serverValue: I18nContextValue = {
      locale: defaultLocale ?? DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key: string, params?: TranslationParams) => {
        const value = getNestedValue(translations[defaultLocale ?? DEFAULT_LOCALE], key);
        if (value === undefined) return key;
        return interpolate(value, params);
      },
      translations: translations[defaultLocale ?? DEFAULT_LOCALE],
    };

    return (
      <I18nContext.Provider value={serverValue}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18nContext(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18nContext must be used within an I18nProvider");
  }
  return context;
}
