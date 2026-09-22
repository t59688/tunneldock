import { zhCN } from "./locales/zh-CN";

export type TranslationSchema = typeof zhCN;

// Helper to produce dot-notation string literal union of nested keys
type DotPrefix<T extends string> = T extends "" ? "" : `.${T}`;

export type DotNestedKeys<T> = (
  T extends object
    ? {
        [K in Exclude<keyof T, symbol>]: `${K}${DotPrefix<DotNestedKeys<T[K]>>}`;
      }[Exclude<keyof T, symbol>]
    : ""
) extends infer D
  ? Extract<D, string>
  : never;

export type TranslationKey = DotNestedKeys<TranslationSchema>;

export type Locale = "zh-CN" | "en-US";
