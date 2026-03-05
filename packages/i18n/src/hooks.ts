"use client";

import { useCallback, useMemo } from "react";
import { useI18nContext } from "./context";
import type { Locale, TranslationParams, TranslationFunction } from "./types";
import { formatDate, formatNumber, formatCurrency, formatRelativeTime } from "./utils";

type Namespace = "common" | "navigation" | "forms" | "settings" | "dashboard" | "shop" | "orders" | "suppliers" | "feeds" | "sync" | "activity" | "supplierDashboard" | "products" | "collections" | "retailers" | "pricingTiers" | "auth";

interface UseTranslationResult {
  t: TranslationFunction;
  locale: Locale;
}

export function useTranslation(namespace?: Namespace): UseTranslationResult {
  const { t: globalT, locale } = useI18nContext();

  const t = useCallback(
    (key: string, params?: TranslationParams): string => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      return globalT(fullKey, params);
    },
    [globalT, namespace]
  );

  return useMemo(() => ({ t, locale }), [t, locale]);
}

export function useLocale(): {
  locale: Locale;
  setLocale: (locale: Locale) => void;
} {
  const { locale, setLocale } = useI18nContext();
  return { locale, setLocale };
}

export function useFormattedDate() {
  const { locale } = useI18nContext();

  return useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      return formatDate(date, locale, options);
    },
    [locale]
  );
}

export function useFormattedNumber() {
  const { locale } = useI18nContext();

  return useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      return formatNumber(value, locale, options);
    },
    [locale]
  );
}

export function useFormattedCurrency() {
  const { locale } = useI18nContext();

  return useCallback(
    (value: number, currency: string = "USD") => {
      return formatCurrency(value, locale, currency);
    },
    [locale]
  );
}

export function useFormattedRelativeTime() {
  const { locale } = useI18nContext();

  return useCallback(
    (date: Date | string | number) => {
      return formatRelativeTime(date, locale);
    },
    [locale]
  );
}
