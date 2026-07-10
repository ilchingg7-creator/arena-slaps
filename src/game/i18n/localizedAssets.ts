import type { Language } from "../config/translations";

export function localizedAssetKey(baseKey: string, language: Language): string {
  return language === "ru" ? `${baseKey}-ru` : baseKey;
}
