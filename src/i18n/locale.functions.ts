import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import type { Locale } from "./dictionary";

const valid = ["en", "fr", "ar"];

export const getInitialLocale = createServerFn({ method: "GET" }).handler(async (): Promise<Locale> => {
  const c = getCookie("mb_locale");
  if (c && valid.includes(c)) return c as Locale;
  const accept = (getRequestHeader("accept-language") ?? "").toLowerCase();
  if (accept.startsWith("ar")) return "ar";
  if (accept.startsWith("fr")) return "fr";
  return "en";
});

export function readClientLocale(): Locale {
  const m = document.cookie.match(/(?:^|; )mb_locale=([^;]+)/);
  return m && m[1] && valid.includes(m[1]) ? (m[1] as Locale) : "en";
}
