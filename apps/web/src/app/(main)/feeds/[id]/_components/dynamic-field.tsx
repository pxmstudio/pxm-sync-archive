"use client";

import { useRef } from "react";
import { Upload, File, X, AlertCircle } from "lucide-react";
import type { ApplicationField } from "@/hooks/use-feed-detail";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Progress } from "@workspace/ui/components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Spinner } from "@workspace/ui/components/spinner";
import { Textarea } from "@workspace/ui/components/textarea";
import { cn } from "@workspace/ui/lib/utils";

interface FieldValue {
  value: string;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
}

interface DynamicFieldProps {
  field: ApplicationField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  error?: string;
  onFileUpload?: (file: File) => Promise<{
    key: string;
    url: string;
    filename: string;
    size: number;
  } | null>;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string | null;
}

export function DynamicField({
  field,
  value,
  onChange,
  error,
  onFileUpload,
  isUploading,
  uploadProgress,
  uploadError,
}: DynamicFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (newValue: string) => {
    onChange({ ...value, value: newValue });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    const result = await onFileUpload(file);
    if (result) {
      onChange({
        value: result.filename,
        fileUrl: result.url,
        fileKey: result.key,
        fileName: result.filename,
        fileSize: result.size,
      });
    }

    // Reset input
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    onChange({ value: "" });
  };

  const renderField = () => {
    switch (field.type) {
      case "text":
      case "email":
      case "phone":
      case "url":
      case "number":
        return (
          <Input
            id={field.id}
            type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
            value={value.value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
            className={cn(error && "border-destructive")}
          />
        );

      case "textarea":
        return (
          <Textarea
            id={field.id}
            value={value.value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={field.description || `Enter ${field.label.toLowerCase()}`}
            rows={4}
            className={cn(error && "border-destructive")}
          />
        );

      case "select":
        return (
          <Select value={value.value} onValueChange={handleChange}>
            <SelectTrigger id={field.id} className={cn(error && "border-destructive")}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "checkbox":
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.id}
              checked={value.value === "true"}
              onCheckedChange={(checked) => handleChange(checked ? "true" : "false")}
            />
            <label
              htmlFor={field.id}
              className="text-sm font-medium cursor-pointer"
            >
              {field.description || field.label}
            </label>
          </div>
        );

      case "file":
        return (
          <div className="space-y-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept={field.allowedFileTypes.join(",")}
              className="hidden"
            />

            {value.fileKey ? (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <File className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{value.fileName}</p>
                    {value.fileSize && (
                      <p className="text-xs text-muted-foreground">
                        {(value.fileSize / 1024).toFixed(1)} KB
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : isUploading ? (
              <div className="p-4 border border-dashed rounded-lg">
                <div className="text-center space-y-2">
                  <Spinner className="h-6 w-6 mx-auto" />
                  <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
                  <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "p-4 border border-dashed rounded-lg cursor-pointer transition-colors hover:border-primary/50",
                  error && "border-destructive"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center space-y-2">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload
                  </p>
                  {field.allowedFileTypes.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {field.allowedFileTypes.join(", ")} up to {field.maxFileSizeMb}MB
                    </p>
                  )}
                </div>
              </div>
            )}

            {uploadError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {uploadError}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      {field.type !== "checkbox" && (
        <Label htmlFor={field.id}>
          {field.label}
          {field.isRequired && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {field.type !== "checkbox" && field.description && (
        <p className="text-sm text-muted-foreground">{field.description}</p>
      )}
      {renderField()}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
