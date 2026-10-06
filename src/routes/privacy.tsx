import { createFileRoute } from "@tanstack/react-router";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: () => seo("Privacy Policy", "How MOROBEST collects and uses usage data, search terms and viewing activity."),
  component: Privacy,
});

const S = ({ h, children }: { h: string; children: React.ReactNode }) => (
  <section className="space-y-2"><h2 className="font-display text-2xl">{h}</h2><div className="space-y-2 text-muted-foreground">{children}</div></section>
);

function Privacy() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 pb-20 pt-28 sm:px-8">
      <h1 className="font-display text-4xl">Privacy Policy</h1>
      <S h="What we collect when you use MOROBEST">
        <p>To run and improve MOROBEST we record usage events: pages you open, titles shown and clicked, the Watch button, when playback starts, pauses, resumes and finishes, how long you watched, subtitle and audio language choices, watchlist and favorite changes, and playback errors.</p>
        <p>When you search, we store the search term in lowercase, shortened to 80 characters, together with which result you clicked.</p>
      </S>
      <S h="Why we use it">
        <ul className="list-disc ps-5">
          <li>To improve search results.</li>
          <li>To calculate what is popular and trending on MOROBEST.</li>
          <li>To improve recommendations.</li>
          <li>To find and fix playback problems.</li>
        </ul>
      </S>
      <S h="How it is identified">
        <p>Usage events are linked to a random identifier stored in your browser, which we store only in scrambled (hashed) form. We do not attach your name, email address or account to these events, and we do not store your IP address with them.</p>
        <p>Search engine crawlers are counted separately and never mixed with viewer statistics.</p>
      </S>
      <S h="How long we keep it">
        <p>Detailed usage events are deleted after 90 days. Playback error reports are kept up to 180 days for troubleshooting. After that only daily totals per title remain, which contain no information about individual visitors.</p>
      </S>
      <S h="Your account">
        <p>If you sign in, your profiles, watchlist, favorites and viewing progress are stored with your account so they follow you across devices. You can remove items from your watchlist and favorites at any time.</p>
      </S>
    </article>
  );
}
