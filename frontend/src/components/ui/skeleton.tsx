import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-2xl bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklch,var(--muted),var(--card)_70%)_50%,var(--muted)_75%)] bg-[length:200%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
