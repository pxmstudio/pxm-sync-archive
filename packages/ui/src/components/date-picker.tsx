"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";
import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";

type CalendarBaseProps = React.ComponentProps<typeof Calendar>;

export type DatePickerProps = Omit<
  CalendarBaseProps,
  "mode" | "selected" | "onSelect"
> & {
  value?: Date;
  defaultValue?: Date;
  onChange?: (date?: Date) => void;
  placeholder?: React.ReactNode;
  /** date-fns format string */
  formatString?: string;
  /** Extra classes for the trigger button */
  className?: string;
  /** Extra props for the trigger button */
  buttonProps?: Omit<
    React.ComponentProps<typeof Button>,
    "className" | "children"
  >;
  /** Classes for the popover content */
  popoverContentClassName?: string;
};

export function DatePicker({
  value,
  defaultValue,
  onChange,
  placeholder = "Pick a date",
  formatString = "PPP",
  className,
  buttonProps,
  popoverContentClassName,
  ...calendarProps
}: DatePickerProps) {
  const isControlled = typeof value !== "undefined";
  const [internalDate, setInternalDate] = React.useState<Date | undefined>(
    defaultValue
  );

  const selectedDate = isControlled ? value : internalDate;

  const handleSelect = React.useCallback(
    (next?: Date) => {
      if (!isControlled) {
        setInternalDate(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-slot="date-picker-trigger"
          data-empty={!selectedDate}
          className={cn(
            "data-[empty=true]:text-muted-foreground w-[280px] justify-start text-left font-normal",
            className
          )}
          {...buttonProps}
        >
          <CalendarIcon />
          {selectedDate ? (
            format(selectedDate, formatString)
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0", popoverContentClassName)}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  );
}
