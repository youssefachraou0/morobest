import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, Globe, Home, Bookmark, Search, User, LogOut, Shield, Users } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, LOCALE_LABELS } from "@/i18n/dictionary";
import { useAuth } from "@/features/auth/AuthProvider";
import { Logo, Star8 } from "./Brand";
import { mbButton } from "./Button";
import { cn } from "@/lib/utils";

const navCls = "relative px-1 py-2 text-sm text-foreground/75 transition hover:text-foreground data-[status=active]:text-gold";

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const { user, activeProfile, profiles, setActiveProfile, signOut, isAdmin } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const kids = activeProfile?.is_kids;
  const links = kids
    ? ([["/kids", t.nav.kids], ["/anime", t.nav.anime]] as const)
    : ([
        ["/movies", t.nav.movies], ["/series", t.nav.series], ["/arabic", t.nav.arabic], ["/ramadan", t.nav.ramadan],
        ["/anime", t.nav.anime], ["/manga", t.nav.manga], ["/kids", t.nav.kids],
      ] as const);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-500", scrolled ? "bg-background/90 backdrop-blur-xl border-b border-border" : "bg-gradient-to-b from-background/90 to-transparent")}>
      <div className="flex h-16 items-center gap-6 px-4 sm:px-8 lg:px-14">
        <Link to="/" aria-label="MOROBEST home"><Logo /></Link>
        <nav className="hidden items-center gap-5 lg:flex" aria-label="Main">
          <Link to="/" className={navCls} activeOptions={{ exact: true }}>{t.nav.home}</Link>
          {links.map(([to, label]) => (
            <Link key={to} to={to} className={navCls}>{label}</Link>
          ))}
          {!kids && (
            <DropdownMenu>
              <DropdownMenuTrigger className={navCls}>{t.nav.more}</DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {([["/classics", t.nav.classics], ["/new", t.nav.new], ["/trending", t.nav.trending], ["/collections", t.nav.collections], ["/explore", t.nav.explore]] as const).map(([to, l]) => (
                  <DropdownMenuItem key={to} onSelect={() => navigate({ to })}>{l}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <Link to="/search" aria-label={t.nav.search} className={mbButton({ variant: "ghost", size: "icon" })}><Search /></Link>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Language" className={mbButton({ variant: "ghost", size: "sm" })}>
              <Globe /> <span className="hidden sm:inline uppercase">{locale}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {LOCALES.map((l) => (
                <DropdownMenuItem key={l} onSelect={() => setLocale(l)} className={cn(l === locale && "text-gold")}>{LOCALE_LABELS[l]}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger aria-label={t.nav.profile} className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald text-gold ring-1 ring-gold/40">
                {activeProfile?.is_kids ? <Star8 className="h-5 w-5" /> : <span className="font-display text-lg">{activeProfile?.display_name?.[0]?.toUpperCase() ?? "M"}</span>}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{activeProfile?.display_name}</DropdownMenuLabel>
                {profiles.filter((p) => p.id !== activeProfile?.id).map((p) => (
                  <DropdownMenuItem key={p.id} onSelect={() => setActiveProfile(p.id)}>
                    <User /> {p.display_name}{p.is_kids && ` · ${t.label.kidsProfile}`}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/profiles" })}><Users /> {t.auth.manageProfiles}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: "/watchlist" })}><Bookmark /> {t.nav.watchlist}</DropdownMenuItem>
                {isAdmin && <DropdownMenuItem onSelect={() => navigate({ to: "/admin" })}><Shield /> {t.nav.admin}</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut().then(() => navigate({ to: "/" }))}><LogOut /> {t.action.signOut}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className={mbButton({ variant: "outline", size: "sm" })}>{t.action.signIn}</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { t } = useI18n();
  const items = [
    ["/", t.nav.home, Home], ["/explore", t.nav.explore, Compass], ["/search", t.nav.search, Search],
    ["/watchlist", t.nav.watchlist, Bookmark], ["/profiles", t.nav.profile, User],
  ] as const;
  return (
    <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="grid grid-cols-5">
        {items.map(([to, label, Icon]) => (
          <li key={to}>
            <Link to={to} activeOptions={{ exact: to === "/" }} className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground data-[status=active]:text-gold">
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="relative mt-16 border-t border-border px-4 pb-28 pt-12 sm:px-8 lg:px-14 lg:pb-12">
      <div className="absolute inset-0 pattern-zellige opacity-[0.03]" aria-hidden />
      <div className="relative flex flex-col gap-8 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 font-display text-lg italic text-muted-foreground">{t.hero.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
          {([["/movies", t.nav.movies], ["/series", t.nav.series], ["/arabic", t.nav.arabic], ["/ramadan", t.nav.ramadan], ["/anime", t.nav.anime], ["/manga", t.nav.manga], ["/kids", t.nav.kids], ["/classics", t.nav.classics], ["/collections", t.nav.collections]] as const).map(([to, l]) => (
            <Link key={to} to={to} className="hover:text-gold">{l}</Link>
          ))}
        </div>
      </div>
      <p className="relative mt-10 text-xs text-muted-foreground">© {new Date().getFullYear()} MOROBEST. {t.footer.rights} {t.footer.legal} · <Link to="/privacy" className="hover:text-gold">{t.footer.privacy}</Link></p>
    </footer>
  );
}
