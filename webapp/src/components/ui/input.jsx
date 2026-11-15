import * as React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex h-11 w-full rounded-xl border border-[#dfe2e7] bg-white px-3 py-2 text-sm text-[#111111] outline-none transition placeholder:text-[#a0a5ad] focus:border-[#111111] focus:ring-2 focus:ring-black/5",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
