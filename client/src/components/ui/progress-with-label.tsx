import * as React from "react";
import { Progress } from "./progress";
import { cn } from "@/lib/utils";

interface ProgressWithLabelProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressWithLabel({
  value,
  label,
  showPercentage = true,
  className
}: ProgressWithLabelProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        {label && <span className="text-muted-foreground">{label}</span>}
        {showPercentage && (
          <span className="font-medium text-foreground">{Math.round(value)}%</span>
        )}
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}
