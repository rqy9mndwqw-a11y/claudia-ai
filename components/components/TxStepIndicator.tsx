"use client";

import type { StepStatus } from "@/lib/defi-adapters";

interface Step {
  label: string;
  description: string;
  status: StepStatus;
}

interface TxStepIndicatorProps {
  steps: Step[];
}

const STATUS_STYLES: Record<StepStatus, { circle: string; line: string; text: string }> = {
  upcoming: {
    circle: "border-zinc-700 bg-transparent",
    line: "bg-zinc-800",
    text: "text-zinc-600",
  },
  active: {
    circle: "border-accent bg-accent/20 animate-pulse",
    line: "bg-accent/30",
    text: "text-white",
  },
  complete: {
    circle: "border-green-500 bg-green-500",
    line: "bg-green-500/40",
    text: "text-green-400",
  },
  error: {
    circle: "border-red-500 bg-red-500/20",
    line: "bg-red-500/30",
    text: "text-red-400",
  },
};

export default function TxStepIndicator({ steps }: TxStepIndicatorProps) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const styles = STATUS_STYLES[step.status];
        const isLast = i === steps.length - 1;

        return (
          <div key={i} className="flex gap-3">
            {/* Circle + Line */}
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${styles.circle}`}>
                {step.status === "complete" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {step.status === "error" && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                {step.status === "active" && (
                  <div className="w-2 h-2 rounded-full bg-accent" />
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-8 ${styles.line}`} />
              )}
            </div>

            {/* Label + Description */}
            <div className="pb-6">
              <p className={`text-sm font-bold ${styles.text}`}>{step.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
