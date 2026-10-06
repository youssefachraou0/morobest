import { createFileRoute, redirect } from "@tanstack/react-router";
import { ramadanQuery } from "@/features/catalog/queries";

export const Route = createFileRoute("/ramadan/")({
  loader: async ({ context }) => {
    const d = await context.queryClient.ensureQueryData(ramadanQuery());
    const year = d.season?.year ?? new Date().getFullYear();
    throw redirect({ to: "/ramadan/$year", params: { year: String(year) } });
  },
});
