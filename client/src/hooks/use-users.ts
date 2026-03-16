import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useUsersList() {
  return useQuery({
    queryKey: [api.auth.users.path],
    queryFn: async () => {
      const res = await fetch(api.auth.users.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.auth.users.responses[200].parse(await res.json());
    },
  });
}
