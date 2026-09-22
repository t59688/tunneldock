import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { zhCN } from "./locales/zh-CN";
import { enUS } from "./locales/en-US";
import { Locale, TranslationKey, TranslationSchema } from "./types";
import { setLocale as apiSetLocale } from "../api";

const STORAGE_KEY = "tunneldock_locale";

const dictionaries: Record<Locale, TranslationSchema> = {
  "zh-CN": zhCN,
  "en-US": enUS,
};

interface I18nContextType {
  locale: Locale;
  setLocale: (newLocale: Locale) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isEn: boolean;
  isZh: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

function detectDefaultLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "zh-CN" || saved === "en-US") {
      return saved;
    }
  } catch {
    // Ignore localStorage access issues
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    if (navigator.language.toLowerCase().startsWith("zh")) {
      return "zh-CN";
    }
    return "en-US";
  }

  return "zh-CN";
}

function resolveNestedKey(obj: any, path: string): string | undefined {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === "string" ? current : undefined;
}

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectDefaultLocale);

  // Sync with document element lang
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // Ignore storage error
    }

    try {
      await apiSetLocale(newLocale);
    } catch (e) {
      console.warn("Backend set_locale sync failed:", e);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const activeDict = dictionaries[locale] || dictionaries["zh-CN"];
      let value = resolveNestedKey(activeDict, key);

      // Fallback to zh-CN if missing in active locale
      if (value === undefined && locale !== "zh-CN") {
        value = resolveNestedKey(dictionaries["zh-CN"], key);
      }

      if (value === undefined) {
        return key;
      }

      if (params) {
        return Object.entries(params).reduce((acc, [paramKey, paramVal]) => {
          return acc.replaceAll(`{${paramKey}}`, String(paramVal));
        }, value);
      }

      return value;
    },
    [locale]
  );

  const contextValue = useMemo<I18nContextType>(
    () => ({
      locale,
      setLocale,
      t,
      isEn: locale === "en-US",
      isZh: locale === "zh-CN",
    }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return context;
}
