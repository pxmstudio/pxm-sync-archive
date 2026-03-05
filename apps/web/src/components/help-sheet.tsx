"use client";

import { useState, ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";

export interface HelpSection {
  title: string;
  description?: string;
  items?: {
    title: string;
    description: string;
    badge?: string;
  }[];
  steps?: {
    title: string;
    description: string;
  }[];
}

interface HelpSheetProps {
  title: string;
  description?: string;
  sections: HelpSection[];
}

export function HelpSheet({ title, description, sections }: HelpSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <CircleHelp className="h-4 w-4" />
          <span className="sr-only">Help</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <ScrollArea className="flex-1 -mt-4">
          <div className="space-y-6 px-4 pb-4">
            {sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {sectionIndex > 0 && <Separator className="mb-6" />}
                <h3 className="font-semibold mb-2">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {section.description}
                  </p>
                )}

                {/* Render items with badges */}
                {section.items && (
                  <div className="space-y-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          {item.badge && (
                            <Badge variant="outline">{item.badge}</Badge>
                          )}
                          <span className="font-medium">{item.title}</span>
                        </div>
                        <p className="text-muted-foreground pl-0">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Render numbered steps */}
                {section.steps && (
                  <div className="space-y-3">
                    {section.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {stepIndex + 1}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">{step.title}</span>
                          <span className="text-muted-foreground">
                            {" "}- {step.description}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Convenience component for just the trigger button
export function HelpTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClick}>
      <CircleHelp className="h-4 w-4" />
      <span className="sr-only">Help</span>
    </Button>
  );
}
