"use client";

import * as React from "react";
import { Check, Globe } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { cn } from "../lib/utils";

export interface Language {
  code: string;
  name: string;
}

interface LanguageSwitcherProps {
  currentLanguage: string;
  languages: Language[];
  onLanguageChange: (code: string) => void;
  className?: string;
  variant?: "default" | "minimal";
}

export function LanguageSwitcher({
  currentLanguage,
  languages,
  onLanguageChange,
  className,
  variant = "default",
}: LanguageSwitcherProps) {
  const currentLang = languages.find((lang) => lang.code === currentLanguage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={variant === "minimal" ? "icon" : "sm"}
          className={cn("gap-2", className)}
        >
          <Globe className="h-4 w-4" />
          {variant === "default" && (
            <span className="hidden sm:inline">{currentLang?.name ?? currentLanguage}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className="gap-2"
          >
            <Check
              className={cn(
                "h-4 w-4",
                currentLanguage === lang.code ? "opacity-100" : "opacity-0"
              )}
            />
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
