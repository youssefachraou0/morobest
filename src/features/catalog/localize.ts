import type { Locale } from "@/i18n/dictionary";
import type { Named, TitleCard, Translation } from "./types";

export function tr(t: Pick<TitleCard, "tr" | "originalTitle">, locale: Locale): Translation {
  return t.tr[locale] ?? t.tr.en ?? { title: t.originalTitle, tagline: null, synopsis: null };
}
export function nameOf(n: Named, locale: Locale) {
  return locale === "ar" ? n.name_ar : locale === "fr" ? n.name_fr : n.name_en;
}
export function ageLabel(age: number) {
  return age === 0 ? "ALL" : `${age}+`;
}
