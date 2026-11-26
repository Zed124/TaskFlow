import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import common from "./en/common.json";

export const defaultNS = "common";
export const resources = { en: { common } } as const;

// Typed keys: t("nav.dashboard") is checked at compile time.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["en"];
  }
}

void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  defaultNS,
  resources,
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

/** Applies language direction to <html>; ready for RTL languages later. */
export function applyDocumentLanguage(lng: string): void {
  document.documentElement.lang = lng;
  document.documentElement.dir = i18n.dir(lng);
}

export default i18n;
