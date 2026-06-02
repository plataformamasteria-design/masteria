"use client";

import { m as motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from "@/lib/utils";

export function SpotlightCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({
    currentTarget,
    clientX,
    clientY,
  }: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <div
      className={cn(
        "group relative rounded-xl transition-all duration-500",
        className
      )}
      onMouseMove={handleMouseMove}
    >
      {/* Background surface */}
      <div className="pointer-events-none absolute inset-0 z-0 rounded-xl border border-border bg-card overflow-hidden" />

      {/* Spotlight glow */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition duration-500 group-hover:opacity-100 z-10"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              500px circle at ${mouseX}px ${mouseY}px,
              rgba(106, 76, 245, 0.08),
              transparent 40%
            )
          `,
        }}
      />
      {/* Spotlight border light */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition duration-500 group-hover:opacity-100 z-10"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              250px circle at ${mouseX}px ${mouseY}px,
              rgba(255, 255, 255, 0.10),
              transparent 40%
            )
          `,
          WebkitMaskImage: "linear-gradient(black, black) padding-box, linear-gradient(black, black)",
          WebkitMaskComposite: "destination-out",
          border: "1px solid transparent"
        }}
      />
      <div className="relative z-20 h-full w-full">{children}</div>
    </div>
  );
}
