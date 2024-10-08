import type { InitOptions } from "i18next";

export const fallbackLng = "en-US";
export const locales = [fallbackLng, "de-DE"] as const;
export type LocaleTypes = (typeof locales)[number];
export const defaultNS = "common";

export function getOptions(lang = fallbackLng, ns = defaultNS): InitOptions {
  return {
    // debug: true, // Set to true to see console logs
    supportedLngs: locales,
    fallbackLng,
    lng: lang,
    fallbackNS: defaultNS,
    defaultNS,
    ns,
  };
}
