"use client"

import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"
import { Button } from "@workspace/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@workspace/ui/components/command"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Badge } from "@workspace/ui/components/badge"
import { ScrollArea } from "@workspace/ui/components/scroll-area"

type Option = { value: string; label: string; disabled?: boolean }

type MultiSelectProps = {
  options: Option[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (values: string[]) => void
  placeholder?: string
  className?: string
  searchable?: boolean
  closeOnSelect?: boolean
  disabled?: boolean
  maxBadges?: number
  disableValues?: string[]
}

function MultiSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Select",
  className,
  searchable = true,
  closeOnSelect = false,
  disabled = false,
  maxBadges = 3,
  disableValues = [],
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<string[]>(
    Array.isArray(defaultValue) ? defaultValue : [],
  )

  const rawSelected = isControlled ? (value as unknown) : (internal as unknown)
  const selected: string[] = Array.isArray(rawSelected)
    ? (rawSelected as string[])
    : rawSelected == null
      ? []
      : [String(rawSelected)]

  const setSelected = React.useCallback(
    (next: string[]) => {
      if (!isControlled) setInternal(next)
      onValueChange?.(next)
    },
    [isControlled, onValueChange],
  )

  const toggle = (val: string) => {
    const set = new Set(selected)
    if (set.has(val)) set.delete(val)
    else set.add(val)
    const next = Array.from(set)
    setSelected(next)
    if (closeOnSelect) setOpen(false)
  }

  const map = new Map(options.map((o) => [o.value, o.label]))
  const selectedLabels = selected.map((v) => map.get(v) ?? v)

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between gap-2 px-2 py-1 bg-transparent",
            "flex h-auto min-h-9 flex-wrap items-center",
            className,
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {selected.slice(0, maxBadges).map((val, index) => {
                const label = selectedLabels[selected.indexOf(val)] ?? val
                return (
                  <Badge key={`${val}-${index}`} variant="secondary" className="flex items-center gap-1">
                    <span className="max-w-[120px] truncate">{label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remove ${label}`}
                      className="ml-1 select-none text-xs"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggle(val)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          e.stopPropagation()
                          toggle(val)
                        }
                      }}
                    >
                      ×
                    </span>
                  </Badge>
                )
              })}
              {selected.length > maxBadges && (
                <Badge variant="outline">+ {selected.length - maxBadges} more</Badge>
              )}
            </div>
          )}
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear selection"
              className="text-muted-foreground hover:text-foreground ml-auto select-none"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setSelected([])
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelected([])
                }
              }}
            >
              ×
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder="Search..." />}
          <ScrollArea className="h-[200px] overflow-y-auto">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((opt, index) => (
                <CommandItem
                  key={`${opt.value}-${index}`}
                  disabled={opt.disabled || disableValues.includes(opt.value)}
                  onSelect={() => {
                    if (opt.disabled || disableValues.includes(opt.value)) return
                    toggle(opt.value)
                  }}
                >
                  <div className="mr-2 flex h-4 w-4 items-center justify-center">
                    <Checkbox checked={selected.includes(opt.value)} aria-label={opt.label} />
                  </div>
                  <span>{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export type { MultiSelectProps, Option as MultiSelectOption }
export { MultiSelect }
