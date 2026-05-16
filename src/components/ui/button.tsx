import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold ring-offset-background transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#635bff] to-[#4f46e5] text-white shadow-button-violet hover:shadow-button-violet-lg hover:scale-[1.02] hover:from-[#4f46e5] hover:to-[#4338ca]",
        destructive:
          "bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white shadow-sm hover:shadow-md hover:scale-[1.02]",
        success:
          "bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-sm hover:shadow-md hover:scale-[1.02]",
        warning:
          "bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-sm hover:shadow-md hover:scale-[1.02]",
        outline:
          "border border-[#635bff] bg-white text-[#635bff] hover:bg-[#f5f4ff] hover:scale-[1.02]",
        secondary:
          "bg-white border border-[#e4e7ec] text-[#0f1117] shadow-sm hover:bg-[#f3f4f8] hover:border-[#c8cdd8] hover:scale-[1.02]",
        ghost:
          "text-[#635bff] hover:bg-[#f5f4ff] hover:text-[#4f46e5]",
        link:
          "text-[#635bff] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-[8px] px-3 text-[13px]",
        lg: "h-11 rounded-[12px] px-8 text-[15px]",
        xl: "h-13 rounded-[12px] px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-[8px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
