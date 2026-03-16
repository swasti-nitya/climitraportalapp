import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useLeavesList() {
  return useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const res = await fetch(api.leaves.list.path, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leaves");
      return api.leaves.list.responses[200].parse(await res.json());
    },
  });
}

export function useLeaveCount(userId: number) {
  return useQuery({
    queryKey: ["leaves", "count", userId],
    queryFn: async () => {
      const url = api.leaves.count.path.replace(":userId", String(userId));
      const res = await fetch(url, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leave count");
      return api.leaves.count.responses[200].parse(await res.json());
    },
  });
}

export function useCreateLeave() {
  return useMutation({
    mutationFn: async (data: {
      startDate: string;
      endDate: string;
      type: "Leave" | "Work From Home";
      leaveCategory?: "Planned" | "Sick";
      reason: string;
      numberOfDays: number;
    }) => {
      const res = await fetch(api.leaves.create.path, {
        method: api.leaves.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create leave");
      }

      return api.leaves.create.responses[201].parse(await res.json());
    },
  });
}

export function useUpdateLeaveStatus() {
  return useMutation({
    mutationFn: async ({
      id,
      status,
      approvalRemark,
    }: {
      id: number;
      status: "Approved" | "Rejected";
      approvalRemark?: string;
    }) => {
      const url = api.leaves.updateStatus.path.replace(":id", String(id));
      const res = await fetch(url, {
        method: api.leaves.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvalRemark }),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update leave status");
      }

      return api.leaves.updateStatus.responses[200].parse(await res.json());
    },
  });
}
