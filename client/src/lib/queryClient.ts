import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Runtime hostname check (identiek aan ZIP-8 bronbundel):
// Op pplx.app sandbox loopt het verkeer via /port/5000 proxy.
// Op Render (en lokale dev) is de API op dezelfde origin → lege string.
const API_BASE =
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".pplx.app")
    ? "/port/5000"
    : "";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    // KRITIEK: credentials: "include" vereist voor cross-origin cookie-uitwisseling
    // op pplx.app (S3-frontend → /port/5000 sandbox-backend).
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
        // KRITIEK: credentials: "include" vereist voor cross-origin cookie op pplx.app.
        credentials: "include",
      });
    } catch {
      // Netwerk-fout (b.v. sandbox nog niet gestart, cold-start timeout).
      // Behandel hetzelfde als 401 zodat de login-gate nooit crasht.
      if (unauthorizedBehavior === "returnNull") return null;
      throw new Error("Netwerk niet bereikbaar. Probeer opnieuw.");
    }

    // pplx.app proxy geeft ook 401 met {error:'auth_required'} voor niet-auth gebruikers.
    // Behandel alle 401-responses als "niet ingelogd" bij returnNull.
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
