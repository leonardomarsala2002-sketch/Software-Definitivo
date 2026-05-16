import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[#635bff] text-white border-transparent",
        secondary:
          "bg-[#f3f4f8] text-[#6b7280] border-transparent",
        destructive:
          "bg-[#fee2e2] text-[#991b1b] border-transparent",
        outline:
          "border border-[#e4e7ec] text-[#6b7280] bg-transparent",
        /* Status variants */
        published:
          "bg-[#d1fae5] text-[#065f46] border-transparent",
        draft:
          "bg-[#fef3c7] text-[#92400e] border-transparent",
        pending:
          "bg-[#dbeafe] text-[#1e40af] border-transparent",
        archived:
          "bg-[#f3f4f6] text-[#6b7280] border-transparent",
        error:
          "bg-[#fee2e2] text-[#991b1b] border-transparent",
        success:
          "bg-[#d1fae5] text-[#065f46] border-transparent",
        warning:
          "bg-[#fef3c7] text-[#92400e] border-transparent",
        info:
          "bg-[#dbeafe] text-[#1e40af] border-transparent",
        violet:
          "bg-[#f5f3ff] text-[#5b21b6] border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
