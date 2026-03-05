"use client";

import { useState, useCallback } from "react";
import { AlertCircle, Send } from "lucide-react";
import { DynamicField } from "./dynamic-field";
import { useSubscribeToFeed } from "@/hooks/use-subscribe-to-feed";
import { useFileUpload } from "@/hooks/use-file-upload";
import type { ApplicationField } from "@/hooks/use-feed-detail";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";

interface FieldValue {
  value: string;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
}

interface ApplicationFormProps {
  feedId: string;
  applicationFields: ApplicationField[];
  onSuccess: () => void;
}

export function ApplicationForm({
  feedId,
  applicationFields,
  onSuccess,
}: ApplicationFormProps) {
  const [requestMessage, setRequestMessage] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { subscribe, isSubmitting, error: subscribeError } = useSubscribeToFeed();
  const { upload, isUploading, progress: uploadProgress, error: uploadError } = useFileUpload({
    purpose: "application_attachment",
    maxSizeMb: 10,
  });

  const handleFieldChange = useCallback((fieldId: string, value: FieldValue) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    // Clear error when user changes value
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldId];
      return newErrors;
    });
  }, []);

  const handleFileUpload = useCallback(
    async (file: File) => {
      const result = await upload(file);
      if (result) {
        return {
          key: result.key,
          url: result.url,
          filename: result.filename,
          size: result.size,
        };
      }
      return null;
    },
    [upload]
  );

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    for (const field of applicationFields) {
      if (field.isRequired) {
        const value = fieldValues[field.id];
        if (!value || !value.value) {
          errors[field.id] = `${field.label} is required`;
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      return;
    }

    // Build custom field responses
    const customFieldResponses = applicationFields.map((field) => {
      const value = fieldValues[field.id] || { value: "" };
      return {
        fieldId: field.id,
        value: value.value,
        fileUrl: value.fileUrl,
        fileKey: value.fileKey,
        fileName: value.fileName,
        fileSize: value.fileSize,
      };
    }).filter((r) => r.value || r.fileKey);

    const result = await subscribe({
      feedId,
      requestMessage: requestMessage || undefined,
      customFieldResponses: customFieldResponses.length > 0 ? customFieldResponses : undefined,
    });

    if (result) {
      onSuccess();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Request Access</CardTitle>
        <CardDescription>
          Fill out the form to request access to this feed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Request Message */}
          <div className="space-y-2">
            <Label htmlFor="requestMessage">Message (optional)</Label>
            <Textarea
              id="requestMessage"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Introduce yourself and explain why you'd like access to this feed..."
              rows={3}
            />
          </div>

          {/* Custom Fields */}
          {applicationFields.length > 0 && (
            <div className="space-y-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">
                Additional Information
              </p>
              {applicationFields.map((field) => (
                <DynamicField
                  key={field.id}
                  field={field}
                  value={fieldValues[field.id] || { value: "" }}
                  onChange={(value) => handleFieldChange(field.id, value)}
                  error={fieldErrors[field.id]}
                  onFileUpload={field.type === "file" ? handleFileUpload : undefined}
                  isUploading={isUploading}
                  uploadProgress={uploadProgress}
                  uploadError={uploadError}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {(submitError || subscribeError) && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {submitError || subscribeError?.message}
            </p>
          )}

          {/* Submit */}
          <Button type="submit" disabled={isSubmitting || isUploading} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Request
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
