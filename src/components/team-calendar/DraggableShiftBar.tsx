import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { getShiftColor, formatEndTime } from "@/lib/shiftColors";
import { GripVertical } from "lucide-react";
import type { ShiftRow } from "@/hooks/useShifts";

interface DraggableShiftBarProps {
  shift: ShiftRow;
  openH: number;
  totalSpan: number;
  canEdit: boolean;
  onShiftUpdate: (id: string, updates: { start_time?: string; end_time?: string }) => void;
  allowedEntries: number[];
  allowedExits: number[];
}

function snapToHour(hour: number, allowed: number[], openH: number, closeH: number): number {
  if (allowed.length === 0) return Math.max(openH, Math.min(closeH, Math.round(hour)));
  // Find nearest allowed hour
  let best = allowed[0];
  for (const a of allowed) {
    if (Math.abs(a - hour) < Math.abs(best - hour)) best = a;
  }
  return best;
}

export function DraggableShiftBar({
  shift,
  openH,
  totalSpan,
  canEdit,
  onShiftUpdate,
  allowedEntries,
  allowedExits,
}: DraggableShiftBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    origStartH: number;
    origEndH: number;
  } | null>(null);
  const [previewStart, setPreviewStart] = useState<number | null>(null);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);

  const sH = parseInt(shift.start_time!.split(":")[0], 10);
  let eH = parseInt(shift.end_time!.split(":")[0], 10);
  if (eH === 0) eH = 24;

  const displayStart = previewStart ?? sH;
  const displayEnd = previewEnd ?? eH;

  const left = ((displayStart - openH) / totalSpan) * 100;
  const width = ((displayEnd - displayStart) / totalSpan) * 100;
  const color = getShiftColor(shift);

  const closeH = openH + totalSpan;

  const getHourFromX = useCallback((clientX: number): number => {
    const container = containerRef.current?.parentElement;
    if (!container) return sH;
    const rect = container.getBoundingClientRect();
    const pct = (clientX - rect.left) / rect.width;
    return openH + pct * totalSpan;
  }, [openH, totalSpan, sH]);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: "move" | "resize-left" | "resize-right") => {
    if (!canEdit || shift.status === "archived" || shift.status === "published") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragState({ type, startX: e.clientX, origStartH: sH, origEndH: eH });
  }, [canEdit, shift.status, sH, eH]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    e.preventDefault();

    const currentH = getHourFromX(e.clientX);
    const deltaH = currentH - getHourFromX(dragState.startX);

    if (dragState.type === "move") {
      const duration = dragState.origEndH - dragState.origStartH;
      let newStart = Math.round(dragState.origStartH + deltaH);
      newStart = Math.max(openH, Math.min(closeH - duration, newStart));
      setPreviewStart(newStart);
      setPreviewEnd(newStart + duration);
    } else if (dragState.type === "resize-left") {
      let newStart = Math.round(dragState.origStartH + deltaH);
      newStart = Math.max(openH, Math.min(dragState.origEndH - 1, newStart));
      setPreviewStart(newStart);
      setPreviewEnd(dragState.origEndH);
    } else if (dragState.type === "resize-right") {
      let newEnd = Math.round(dragState.origEndH + deltaH);
      newEnd = Math.max(dragState.origStartH + 1, Math.min(closeH, newEnd));
      setPreviewStart(dragState.origStartH);
      setPreviewEnd(newEnd);
    }
  }, [dragState, getHourFromX, openH, closeH]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    const finalStart = previewStart ?? sH;
    const finalEnd = previewEnd ?? eH;

    // Snap to allowed hours
    const snappedStart = dragState.type !== "resize-right"
      ? snapToHour(finalStart, allowedEntries, openH, closeH)
      : finalStart;
    const snappedEnd = dragState.type !== "resize-left"
      ? snapToHour(finalEnd, allowedExits, openH, closeH)
      : finalEnd;

    // Only update if changed
    if (snappedStart !== sH || snappedEnd !== eH) {
      const fmtStart = `${String(snappedStart).padStart(2, "0")}:00:00`;
      const fmtEnd = `${String(snappedEnd === 24 ? 0 : snappedEnd).padStart(2, "0")}:00:00`;
      onShiftUpdate(shift.id, { start_time: fmtStart, end_time: fmtEnd });
    }

    setDragState(null);
    setPreviewStart(null);
    setPreviewEnd(null);
  }, [dragState, previewStart, previewEnd, sH, eH, allowedEntries, allowedExits, openH, closeH, onShiftUpdate, shift.id]);

  const isDraft = shift.status === "draft";
  const isDraggable = canEdit && isDraft;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute top-0.5 bottom-0.5 rounded-md border flex items-center justify-center group/bar transition-shadow",
        color.bg,
        color.border,
        isDraggable && "cursor-grab active:cursor-grabbing hover:shadow-lg hover:ring-2 hover:ring-primary/40",
        dragState && "shadow-xl ring-2 ring-primary z-10",
      )}
      style={{
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(100, width)}%`,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Left resize handle */}
      {isDraggable && (
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 rounded-l-md z-10 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity"
          onPointerDown={(e) => handlePointerDown(e, "resize-left")}
        >
          <div className="w-px h-3 bg-primary/50" />
        </div>
      )}

      {/* Move handle (center) */}
      <div
        className={cn("flex-1 flex items-center justify-center min-w-0 px-1", isDraggable && "cursor-grab active:cursor-grabbing")}
        onPointerDown={(e) => isDraggable && handlePointerDown(e, "move")}
      >
        {isDraggable && (
          <GripVertical className="h-3 w-3 text-current opacity-0 group-hover/bar:opacity-40 shrink-0 mr-0.5 rotate-90" />
        )}
        <span className={cn("text-[10px] font-semibold truncate", color.text)}>
          {String(displayStart).padStart(2, "0")}:00–{formatEndTime(`${String(displayEnd === 24 ? 0 : displayEnd).padStart(2, "0")}:00`)}
        </span>
      </div>

      {/* Right resize handle */}
      {isDraggable && (
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/20 rounded-r-md z-10 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity"
          onPointerDown={(e) => handlePointerDown(e, "resize-right")}
        >
          <div className="w-px h-3 bg-primary/50" />
        </div>
      )}
    </div>
  );
}
