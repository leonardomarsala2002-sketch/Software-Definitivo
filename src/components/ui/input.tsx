import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[10px] border border-[#e4e7ec] bg-white px-3 py-2",
          "text-sm text-[#0f1117] placeholder:text-[#c4c9d4]",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:border-[#635bff] focus-visible:ring-[3px] focus-visible:ring-[rgba(99,91,255,0.15)]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#f3f4f8]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
