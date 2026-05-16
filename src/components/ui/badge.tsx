import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-sky-600 text-white",
        secondary:   "bg-slate-100 text-slate-600",
        destructive: "bg-red-100 text-red-700",
        outline:     "border border-slate-200 text-slate-600 bg-transparent",
        published:   "bg-emerald-100 text-emerald-700",
        draft:       "bg-amber-100 text-amber-700",
        pending:     "bg-blue-100 text-blue-700",
        archived:    "bg-slate-100 text-slate-500",
        error:       "bg-red-100 text-red-700",
        success:     "bg-emerald-100 text-emerald-700",
        warning:     "bg-amber-100 text-amber-700",
        info:        "bg-sky-100 text-sky-700",
        violet:      "bg-violet-100 text-violet-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
