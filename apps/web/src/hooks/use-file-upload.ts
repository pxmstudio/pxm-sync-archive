"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";

interface UploadedFile {
  key: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

interface UseFileUploadOptions {
  purpose: string;
  maxSizeMb?: number;
  allowedTypes?: string[];
}

export function useFileUpload(options: UseFileUploadOptions) {
  const { getToken } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { purpose, maxSizeMb = 10, allowedTypes } = options;

  const validateFile = useCallback(
    (file: File): string | null => {
      // Check file size
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return `File size exceeds ${maxSizeMb}MB limit`;
      }

      // Check file type if restrictions provided
      if (allowedTypes && allowedTypes.length > 0) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        const isAllowedExtension = allowedTypes.some((type) => {
          if (type.startsWith(".")) {
            return type.toLowerCase() === `.${extension}`;
          }
          return file.type.startsWith(type.replace("*", ""));
        });

        if (!isAllowedExtension) {
          return `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`;
        }
      }

      return null;
    },
    [maxSizeMb, allowedTypes]
  );

  const upload = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      setError(null);
      setProgress(0);

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return null;
      }

      setIsUploading(true);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        // Create form data for direct upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", purpose);

        // We'll use XMLHttpRequest for progress tracking
        const result = await new Promise<UploadedFile>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                if (response.success && response.data) {
                  resolve(response.data);
                } else {
                  reject(
                    new Error(response.error?.message || "Upload failed")
                  );
                }
              } catch {
                reject(new Error("Invalid response from server"));
              }
            } else {
              try {
                const response = JSON.parse(xhr.responseText);
                reject(new Error(response.error?.message || "Upload failed"));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          };

          xhr.onerror = () => {
            reject(new Error("Network error during upload"));
          };

          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";
          xhr.open("POST", `${apiUrl}/internal/uploads/direct`);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.setRequestHeader("X-Active-Role", "retailer");
          xhr.send(formData);
        });

        setProgress(100);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        setError(message);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [getToken, purpose, validateFile]
  );

  const getDownloadUrl = useCallback(
    async (key: string): Promise<string | null> => {
      try {
        const token = await getToken();
        if (!token) return null;

        const result = await apiClient<{ url: string }>(
          `/internal/uploads/${encodeURIComponent(key)}`,
          { token }
        );
        return result.url;
      } catch (err) {
        console.error("Failed to get download URL:", err);
        return null;
      }
    },
    [getToken]
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    upload,
    getDownloadUrl,
    isUploading,
    progress,
    error,
    reset,
  };
}
