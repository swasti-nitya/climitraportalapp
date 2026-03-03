import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useHolidaysList() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const res = await fetch(api.holidays.list.path, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch holidays");
      return api.holidays.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateHoliday() {
  return useMutation({
    mutationFn: async (data: {
      date: string;
      name: string;
      description?: string;
    }) => {
      const res = await fetch(api.holidays.create.path, {
        method: api.holidays.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create holiday");
      }

      return api.holidays.create.responses[201].parse(await res.json());
    },
  });
}

export function useDeleteHoliday() {
  return useMutation({
    mutationFn: async (id: number) => {
      const url = api.holidays.delete.path.replace(":id", String(id));
      const res = await fetch(url, {
        method: api.holidays.delete.method,
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete holiday");
      }

      return api.holidays.delete.responses[200].parse(await res.json());
    },
  });
}
