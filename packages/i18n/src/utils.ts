import { type Locale, DEFAULT_LOCALE, LOCALES, type TranslationParams } from "./types";

const LOCALE_STORAGE_KEY = "pxm-locale";

export function detectBrowserLocale(): Locale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  // Check localStorage first
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && LOCALES.includes(stored as Locale)) {
    return stored as Locale;
  }

  // Check browser language
  const browserLang = navigator.language.split("-")[0];
  if (LOCALES.includes(browserLang as Locale)) {
    return browserLang as Locale;
  }

  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function interpolate(
  template: string,
  params?: TranslationParams
): string {
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = params[key];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

export function getNestedValue(obj: unknown, path: string): string | undefined {
  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

export function formatDate(
  date: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = date instanceof Date ? date : new Date(date);
  const localeString = locale === "ro" ? "ro-RO" : "en-US";

  return d.toLocaleDateString(localeString, {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  });
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions
): string {
  const localeString = locale === "ro" ? "ro-RO" : "en-US";
  return new Intl.NumberFormat(localeString, options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency: string = "USD"
): string {
  const localeString = locale === "ro" ? "ro-RO" : "en-US";
  return new Intl.NumberFormat(localeString, {
    style: "currency",
    currency,
  }).format(value);
}

export function formatRelativeTime(
  date: Date | string | number,
  locale: Locale
): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const localeString = locale === "ro" ? "ro-RO" : "en-US";
  const rtf = new Intl.RelativeTimeFormat(localeString, { numeric: "auto" });

  if (diffDays > 0) {
    return rtf.format(-diffDays, "day");
  }
  if (diffHours > 0) {
    return rtf.format(-diffHours, "hour");
  }
  if (diffMins > 0) {
    return rtf.format(-diffMins, "minute");
  }
  return rtf.format(-diffSecs, "second");
}
