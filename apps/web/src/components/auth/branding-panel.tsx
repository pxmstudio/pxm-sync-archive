"use client";

import { ArrowLeftRight } from "lucide-react";

export function BrandingPanel() {
  return (
    <div className="relative flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 overflow-hidden order-first md:order-last min-h-[200px] md:min-h-0">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Gradient orbs */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-4 text-white px-8">
        <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
          <ArrowLeftRight className="h-8 w-8 text-white/80" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">PXM Sync</h2>
          <p className="text-white/60 text-sm max-w-[260px] leading-relaxed">
            Product synchronization platform for e-commerce stores
          </p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-900/80 to-transparent pointer-events-none" />
    </div>
  );
}
