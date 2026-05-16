import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden relative",
        "bg-gradient-to-r from-[#f3f4f8] via-[#ede9fe] to-[#f3f4f8]",
        "bg-[length:200%_100%] animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
