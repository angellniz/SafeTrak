import * as React from "react";
import { cn } from "../../lib/utils";

const Badge = ({ className, variant = "default", ...props }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
      variant === "safe" && "bg-[#e7f7ee] text-[#21834a]",
      variant === "warning" && "bg-[#fff6d9] text-[#9a7613]",
      variant === "danger" && "bg-[#ffe8e8] text-[#b33737]",
      variant === "neutral" && "bg-[#f0f1f3] text-[#5d626a]",
      variant === "default" && "bg-[#111111] text-white",
      className
    )}
    {...props}
  />
);

export { Badge };
