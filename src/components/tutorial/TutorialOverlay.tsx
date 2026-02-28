import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TutorialStep } from "./tutorialSteps";

interface Props {
  steps: TutorialStep[];
  onComplete: () => void;
}

export function TutorialOverlay({ steps, onComplete }: Props) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[current];
  const isFirst = current === 0;
  const isLast = current === steps.length - 1;

  const highlightElement = useCallback(() => {
    if (!step.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const r = el.getBoundingClientRect();
      setRect(r);
    } else {
      setRect(null);
    }
  }, [step.selector]);

  // Navigate to route if needed, then highlight
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      // Wait for navigation + render
      const t = setTimeout(highlightElement, 400);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(highlightElement, 150);
      return () => clearTimeout(t);
    }
  }, [current, step.route, location.pathname, navigate, highlightElement]);

  // Recalculate on resize
  useEffect(() => {
    const handler = () => highlightElement();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [highlightElement]);

  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent((c) => c + 1);
    }
  };

  const goPrev = () => {
    if (!isFirst) setCurrent((c) => c - 1);
  };

  // Tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!rect) {
      // Center on screen
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 12;
    const tooltipWidth = 340;
    const tooltipHeight = 200;

    // Prefer below the element
    let top = rect.bottom + padding;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // If overflows bottom, go above
    if (top + tooltipHeight > window.innerHeight) {
      top = rect.top - tooltipHeight - padding;
    }

    // Clamp left
    left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
    top = Math.max(12, top);

    return { position: "fixed", top, left, width: tooltipWidth };
  };

  return (
    <div className="fixed inset-0 z-[99998]">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tutorial-mask)"
          style={{ pointerEvents: "all" }}
        />
      </svg>

      {/* Highlight ring */}
      {rect && (
        <div
          className="absolute rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="rounded-2xl border border-border bg-card shadow-2xl p-5 z-[99999]"
        style={getTooltipStyle()}
      >
        {/* Close button */}
        <button
          onClick={onComplete}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Chiudi tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === current ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>

        {/* Step counter + nav */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {current + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={goPrev} className="h-8 gap-1 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                Indietro
              </Button>
            )}
            <Button size="sm" onClick={goNext} className="h-8 gap-1 text-xs rounded-lg">
              {isLast ? "Fine" : "Avanti"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
