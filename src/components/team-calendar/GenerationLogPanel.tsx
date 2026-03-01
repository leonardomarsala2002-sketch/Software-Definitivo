import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, FileText, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GenerationRun } from "@/hooks/useGenerationRuns";

interface GenerationLogPanelProps {
  generationRuns: GenerationRun[];
  department: "sala" | "cucina";
}

export function GenerationLogPanel({ generationRuns, department }: GenerationLogPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const latestRun = useMemo(() => {
    return generationRuns.find(r => r.department === department && r.status === "completed");
  }, [generationRuns, department]);

  const dayLog = useMemo(() => {
    if (!latestRun?.notes) return null;
    const marker = "--- LOG GIORNALIERO DETTAGLIATO ---";
    const idx = latestRun.notes.indexOf(marker);
    if (idx < 0) return null;
    return latestRun.notes.slice(idx + marker.length).trim();
  }, [latestRun]);

  const lines = useMemo(() => dayLog ? dayLog.split("\n") : [], [dayLog]);

  // Parse into day sections for visual grouping
  const sections = useMemo(() => {
    const result: { title: string; lines: { text: string; type: "success" | "skip" | "error" | "info" | "header" }[] }[] = [];
    let current: typeof result[0] | null = null;

    for (const line of lines) {
      if (line.startsWith("===")) {
        if (current) result.push(current);
        current = { title: line.replace(/===/g, "").trim(), lines: [] };
        continue;
      }
      if (!current) {
        current = { title: "Info", lines: [] };
      }
      const trimmed = line.trim();
      if (!trimmed) continue;

      let type: "success" | "skip" | "error" | "info" | "header" = "info";
      if (trimmed.includes("✅")) type = "success";
      else if (trimmed.includes("⏭️")) type = "skip";
      else if (trimmed.includes("❌")) type = "error";
      else if (trimmed.includes("📊") || trimmed.includes("📈") || trimmed.includes("💡")) type = "header";

      current.lines.push({ text: trimmed, type });
    }
    if (current) result.push(current);
    return result;
  }, [lines]);

  if (!dayLog) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(dayLog);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-4 rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-foreground block leading-tight">
              Log Generazione AI
            </span>
            <span className="text-[11px] text-muted-foreground">
              Dettaglio decisioni per giorno · {department === "sala" ? "Sala" : "Cucina"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {sections.length} sezioni
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <>
          <div className="px-4 pt-2 pb-1 flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-3 gap-1.5"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiato" : "Copia tutto"}
            </Button>
          </div>
          <ScrollArea className="max-h-[500px]">
            <div className="px-4 pb-4 space-y-3">
              {sections.map((section, sIdx) => (
                <DaySection key={sIdx} section={section} />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function DaySection({ section }: { section: { title: string; lines: { text: string; type: string }[] } }) {
  const [open, setOpen] = useState(true);
  const hasErrors = section.lines.some(l => l.type === "error");
  const hasSkips = section.lines.some(l => l.type === "skip");

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 transition-colors text-left",
          hasErrors ? "bg-destructive/8" : "bg-muted/40"
        )}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-semibold",
            hasErrors ? "text-destructive" : "text-foreground"
          )}>
            {section.title}
          </span>
          {hasErrors && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-3.5">buchi</Badge>
          )}
          {hasSkips && !hasErrors && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5">saltati</Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-0.5">
          {section.lines.map((line, lIdx) => (
            <p
              key={lIdx}
              className={cn(
                "text-[11px] leading-relaxed font-mono",
                line.type === "success" && "text-emerald-700 dark:text-emerald-400",
                line.type === "skip" && "text-muted-foreground",
                line.type === "error" && "text-destructive font-medium",
                line.type === "info" && "text-foreground",
                line.type === "header" && "text-primary font-medium",
              )}
            >
              {line.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
