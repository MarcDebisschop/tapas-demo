import { QueryClient, QueryFunction } from "@tanstack/react-query";

// __PORT_5000__ wordt door deploy_website vervangen door "port/5000" (zonder leading slash).
// Op lokale dev blijft de sentinel staan → startsWith("__") = true → lege string (relatief).
// Op pplx.app wordt het "port/5000" → startsWith("__") = false → we voegen / toe.
const _sentinel = "__PORT_5000__";
const API_BASE = _sentinel.startsWith("__") ? "" : "/" + _sentinel;

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
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      // KRITIEK: credentials: "include" vereist voor cross-origin cookie op pplx.app.
      credentials: "include",
    });

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
