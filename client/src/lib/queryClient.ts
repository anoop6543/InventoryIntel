
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0] as string, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            return null;
          }
          throw new Error(await response.text());
        }

        return response.json();
      }
    }
  }
})
