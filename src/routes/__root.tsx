import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, dirFor, useI18n } from "@/i18n/I18nProvider";
import { getInitialLocale, readClientLocale } from "@/i18n/locale.functions";
import type { Locale } from "@/i18n/dictionary";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { Header, MobileNav, Footer } from "@/components/mb/Header";
import { FullPageMessage } from "@/components/mb/States";
import { mbButton } from "@/components/mb/Button";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  const { t } = useI18n();
  return <FullPageMessage code="404" title={t.error.notFound} homeLabel={t.nav.home} />;
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="font-display text-7xl text-gold-gradient">500</p>
        <h1 className="mt-4 font-display text-2xl">Something went wrong on our side.</h1>
        <button onClick={() => { router.invalidate(); reset(); }} className={mbButton({ className: "mt-6" })}>Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async (): Promise<{ locale: Locale }> => ({
    locale: typeof window === "undefined" ? await getInitialLocale() : readClientLocale(),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0d1015" },
      { property: "og:site_name", content: "MOROBEST" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Kufi+Arabic:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const { locale } = Route.useRouteContext();
  return (
    <html lang={locale} dir={dirFor(locale)} className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient, locale } = Route.useRouteContext();
  const immersive = useRouterState({ select: (s) => s.location.pathname.startsWith("/watch") });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider initial={locale}>
        <AuthProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
            Skip to content
          </a>
          {!immersive && <Header />}
          <main id="main" className="min-h-screen">
            <Outlet />
          </main>
          {!immersive && <Footer />}
          {!immersive && <MobileNav />}
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
