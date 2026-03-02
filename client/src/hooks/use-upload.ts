import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useUpload() {
  return useMutation({
    mutationFn: async ({ filename, content }: { filename: string; content: string }) => {
      const res = await fetch(api.uploads.create.path, {
        method: api.uploads.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content }),
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Failed to upload file");
      return api.uploads.create.responses[200].parse(await res.json());
    },
  });
}

// Utility to convert file to base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
