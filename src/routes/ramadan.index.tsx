import { createFileRoute, redirect } from "@tanstack/react-router";
import { ramadanHubQuery } from "@/features/editorial/ramadan.functions";

export const Route = createFileRoute("/ramadan/")({
  loader: async ({ context }) => {
    const d = await context.queryClient.ensureQueryData(ramadanHubQuery(undefined, context.locale));
    const year = d.season?.year ?? new Date().getFullYear();
    throw redirect({ to: "/ramadan/$year", params: { year: String(year) } });
  },
});
