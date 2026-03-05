"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
  allowCustomValue?: boolean;
  onSearchChange?: (search: string) => void;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled,
  isLoading,
  allowCustomValue,
  onSearchChange,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  // Format display value: use label if option found, otherwise format fullKey nicely
  const displayValue = React.useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (!value) return placeholder;
    // If value looks like a fullKey (namespace.key), format it nicely
    if (value.includes(".")) {
      const parts = value.split(".");
      const namespace = parts.slice(0, -1).join(".");
      const key = parts[parts.length - 1];
      return `${key} (${namespace})`;
    }
    return value;
  }, [selectedOption, value, placeholder]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    onSearchChange?.(newSearch);
  };

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue === value ? "" : selectedValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between bg-transparent", className)}
          disabled={disabled}
        >
          <span className="truncate">{displayValue}</span>
          {isLoading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="!w-[--radix-popover-trigger-width] min-w-0 p-0">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={search}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {allowCustomValue && search ? (
                    <button
                      type="button"
                      className="w-full px-2 py-1.5 text-sm hover:bg-accent rounded"
                      onClick={() => {
                        onValueChange(search);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      Use &quot;{search}&quot;
                    </button>
                  ) : (
                    emptyMessage
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleSelect}
                    >
                      {option.label}
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
