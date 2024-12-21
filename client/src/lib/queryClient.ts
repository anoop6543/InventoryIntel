import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) {
            return null;
          }

          const errorText = await res.text();
          throw new Error(errorText || res.statusText);
        }

        return res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        // Don't retry on 401 unauthorized
        if (error.message.includes("401")) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    }
  },
});