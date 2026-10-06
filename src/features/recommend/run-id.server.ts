const H = "X-Lovable-AIG-Run-ID";
// Request-local fetch wrapper: resends a gateway-issued run id, captures the minted one. Never mints ids.
export function createLovableAiGatewayRunIdFetch(initialRunId?: string) {
  let runId = initialRunId?.trim() || undefined;
  return {
    getRunId: () => runId,
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(H)) headers.set(H, runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get(H)?.trim() || undefined;
      return res;
    },
  };
}
