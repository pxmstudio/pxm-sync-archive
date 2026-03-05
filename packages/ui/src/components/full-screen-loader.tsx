"use client"

import { motion, useMotionValue, useTransform, animate } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"
import { useEffect, useState } from "react"

function FullScreenLoader({ className }: { className?: string }) {
  const progress = useMotionValue(0)
  const [displayProgress, setDisplayProgress] = useState(0)

  const progressWidth = useTransform(progress, [0, 100], ["0%", "100%"])

  useEffect(() => {
    const animation = animate(progress, 100, {
      duration: 2,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setDisplayProgress(Math.round(v)),
    })

    return () => animation.stop()
  }, [progress])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end bg-background",
        className
      )}
    >
      {/* Giant percentage in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="font-mono text-[20vw] font-bold leading-none tracking-tighter text-foreground/[0.03]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {displayProgress}
        </motion.span>
      </div>

      {/* Bottom section */}
      <div className="relative px-6 pb-8">
        {/* Progress text */}
        <div className="mb-4 flex items-baseline justify-between">
          <motion.span
            className="font-mono text-sm uppercase tracking-widest text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Loading
          </motion.span>
          <motion.span
            className="font-mono text-5xl font-bold tabular-nums tracking-tight text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {displayProgress}%
          </motion.span>
        </div>

        {/* Progress bar track */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full bg-foreground"
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </motion.div>
  )
}

export { FullScreenLoader }
