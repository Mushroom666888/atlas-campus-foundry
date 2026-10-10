import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import english from "./locales/en.json";
import metadata from "./locales/metadata.en.json";

const storageKey = "atlas.language";
function savedLanguage() {
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
void i18n.use(initReactI18next).init({
  lng: savedLanguage(),
  fallbackLng: "zh-CN",
  initAsync: false,
  keySeparator: false,
  nsSeparator: false,
  resources: {
    en: { translation: { ...english, ...metadata } },
    "zh-CN": { translation: {} },
  },
  interpolation: { escapeValue: false },
  returnEmptyString: true,
});
export function t(
  value: string,
  variables: Record<string, string | number> = {},
): string {
  return String(i18n.t(value, { ...variables, defaultValue: value }));
}
export const localeTag = () => (i18n.language === "en" ? "en-US" : "zh-CN");
function reflectLanguage() {
  document.documentElement.lang = localeTag();
  document.title =
    i18n.language === "en"
      ? "Atlas · Campus App Foundry"
      : "Atlas · 校园应用创作平台";
}
reflectLanguage();
i18n.on("languageChanged", reflectLanguage);
window.addEventListener("storage", (event) => {
  if (event.key === storageKey)
    void i18n.changeLanguage(event.newValue === "en" ? "en" : "zh-CN");
});
export function useLanguage() {
  return useTranslation();
}
export function LanguageSelect() {
  const { i18n: language } = useTranslation();
  return (
    <label className="language-select">
      <Languages size={17} aria-hidden="true" />
      <select
        aria-label="语言 / Language"
        value={language.language}
        onChange={(event) => {
          const next = event.target.value;
          try {
            localStorage.setItem(storageKey, next);
          } catch {
            /* In-memory selection still works. */
          }
          void language.changeLanguage(next);
        }}
      >
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
