import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Wand2, Eye, Shuffle, RefreshCw, BarChart2, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PageHeader from "@/components/PageHeader";

type AIFeature =
  | "propose_schedule"
  | "suggest_modifications"
  | "explain_assignment"
  | "suggest_alternatives"
  | "partial_regen"
  | "quality_report"
  | "highlight_criticalities";

interface FeatureConfig {
  id: AIFeature;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  roles: string[];
}

const FEATURES: FeatureConfig[] = [
  {
    id: "propose_schedule",
    label: "Proponi turno",
    description: "Genera una proposta di turno settimanale completa partendo da zero.",
    icon: Wand2,
    color: "text-primary",
    roles: ["admin", "store_manager"],
  },
  {
    id: "suggest_modifications",
    label: "Suggerisci miglioramenti",
    description: "Analizza il turno attuale e suggerisce ottimizzazioni.",
    icon: Sparkles,
    color: "text-amber-500",
    roles: ["admin", "store_manager"],
  },
  {
    id: "explain_assignment",
    label: "Spiega assegnazione",
    description: "Spiega in italiano perché un dipendente è stato assegnato a un certo turno.",
    icon: Eye,
    color: "text-sky-500",
    roles: ["admin", "store_manager"],
  },
  {
    id: "suggest_alternatives",
    label: "Alternative conflitti",
    description: "Propone soluzioni alternative per conflitti o buchi di copertura.",
    icon: Shuffle,
    color: "text-violet-500",
    roles: ["admin", "store_manager"],
  },
  {
    id: "partial_regen",
    label: "Rigenera da data",
    description: "Rigenera il turno da una certa data in poi, preservando i turni bloccati.",
    icon: RefreshCw,
    color: "text-emerald-500",
    roles: ["admin", "store_manager"],
  },
  {
    id: "quality_report",
    label: "Report qualità",
    description: "Genera un report narrativo sulla qualità del turno attuale con analisi dettagliata.",
    icon: BarChart2,
    color: "text-orange-500",
    roles: ["admin", "store_manager"],
  },
  {
    id: "highlight_criticalities",
    label: "Criticità",
    description: "Identifica slot scoperti, dipendenti sovraccarichi e richieste insoddisfatte.",
    icon: AlertTriangle,
    color: "text-rose-500",
    roles: ["admin", "store_manager"],
  },
];

interface AIResult {
  feature: AIFeature;
  result?: {
    text?: string;
    structuredData?: Record<string, unknown>;
    uncoveredSlots?: unknown[];
    overloadedEmployees?: unknown[];
    atRiskCoverage?: unknown[];
    summary?: string;
  };
  proposal?: {
    shifts: unknown[];
    qualityScore: number;
    generalReasoning?: string;
    autoCorrectionsApplied: string[];
    softWarnings: unknown[];
  };
  error?: string;
  hardViolations?: unknown[];
  violationsSummary?: string;
}

function ResultView({ result }: { result: AIResult }) {
  const [expanded, setExpanded] = useState(true);

  if (result.error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Errore</p>
            <p className="text-xs text-destructive/80 mt-1">{result.error}</p>
            {result.violationsSummary && (
              <p className="text-xs text-muted-foreground mt-2 font-mono">{result.violationsSummary}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Text-only features
  if (result.result) {
    const r = result.result;
    const structuredData = r.structuredData;

    return (
      <div className="space-y-3">
        {structuredData && (
          <div className="flex flex-wrap gap-2">
            {typeof (structuredData as any).qualityScore === "number" && (
              <Badge className="bg-primary/15 text-primary border-0">
                Score: {(structuredData as any).qualityScore}/100
              </Badge>
            )}
          </div>
        )}

        {r.text && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{r.text}</p>
          </div>
        )}

        {r.summary && (
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Sommario AI</p>
            <p className="text-sm text-foreground">{r.summary}</p>
          </div>
        )}

        {(r.uncoveredSlots as any[])?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-destructive mb-1">
              Slot scoperti ({(r.uncoveredSlots as any[]).length})
            </p>
            <div className="space-y-1">
              {(r.uncoveredSlots as any[]).slice(0, 5).map((s: any, i) => (
                <div key={i} className="text-xs text-muted-foreground bg-destructive/5 rounded-lg px-3 py-1.5">
                  {s.date} — {s.hourSlot} ({s.department}) — mancano {s.shortfall} persone
                </div>
              ))}
            </div>
          </div>
        )}

        {(r.overloadedEmployees as any[])?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-600 mb-1">
              Dipendenti sovraccarichi ({(r.overloadedEmployees as any[]).length})
            </p>
            <div className="space-y-1">
              {(r.overloadedEmployees as any[]).slice(0, 5).map((e: any, i) => (
                <div key={i} className="text-xs text-muted-foreground bg-amber-500/5 rounded-lg px-3 py-1.5">
                  {e.name} — {e.reason}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Proposal features (shifts)
  if (result.proposal) {
    const p = result.proposal;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Proposta valida
          </Badge>
          <Badge className="bg-primary/15 text-primary border-0">
            Score: {p.qualityScore}/100
          </Badge>
          <Badge variant="outline" className="text-xs">
            {p.shifts.length} turni
          </Badge>
        </div>

        {p.generalReasoning && (
          <div className="rounded-lg bg-secondary p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Ragionamento AI</p>
            <p className="text-sm text-foreground">{p.generalReasoning}</p>
          </div>
        )}

        {p.autoCorrectionsApplied.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-600 mb-1">
              Auto-correzioni applicate ({p.autoCorrectionsApplied.length})
            </p>
            <div className="space-y-0.5">
              {p.autoCorrectionsApplied.map((c, i) => (
                <p key={i} className="text-xs text-muted-foreground">{c}</p>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Nascondi" : "Mostra"} turni ({p.shifts.length})
        </button>

        {expanded && (
          <ScrollArea className="max-h-60 rounded-lg border border-border">
            <div className="p-2 space-y-0.5">
              {(p.shifts as any[]).map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/30 text-xs">
                  <span className="font-mono text-muted-foreground w-24 shrink-0">{s.date}</span>
                  <span className="text-foreground truncate">{s.userId?.slice(0, 8)}</span>
                  {s.isDayOff ? (
                    <Badge className="ml-auto text-[9px] px-1 py-0 bg-muted text-muted-foreground border-0">Riposo</Badge>
                  ) : (
                    <span className="ml-auto font-mono text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    );
  }

  return null;
}

export default function AIAssistant() {
  const { role, activeStore } = useAuth();
  const [selectedFeature, setSelectedFeature] = useState<AIFeature>("propose_schedule");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((day + 6) % 7));
    return mon.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);

  const isManager = role === "admin" || role === "store_manager" || role === "super_admin";
  const visibleFeatures = FEATURES.filter((f) =>
    isManager ? true : f.roles.includes(role ?? "")
  );

  const handleRun = async () => {
    if (!activeStore?.id) {
      toast.error("Nessuno store selezionato");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          action: selectedFeature,
          store_id: activeStore.id,
          week_start: weekStart,
          params: notes ? { notes } : {},
        },
      });
      if (error) throw error;
      setResult(data as AIResult);
    } catch (err: any) {
      const msg = err.message ?? "Errore AI";
      if (msg.includes("503") || msg.includes("non configurato") || msg.includes("API")) {
        toast.error("AI non configurata. Contatta l'amministratore per impostare la chiave API.");
      } else {
        toast.error(`Errore: ${msg}`);
      }
      setResult({ feature: selectedFeature, error: msg });
    } finally {
      setLoading(false);
    }
  };

  const selectedConfig = FEATURES.find((f) => f.id === selectedFeature)!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        subtitle="Pianificazione intelligente assistita dall'AI"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature selector */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Seleziona funzione
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-1">
            {visibleFeatures.map((f) => {
              const Icon = f.icon;
              const active = selectedFeature === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => { setSelectedFeature(f.id); setResult(null); }}
                  className={`w-full flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${active ? "text-primary" : f.color}`} />
                  <div>
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{f.description}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                {(() => { const Icon = selectedConfig.icon; return <Icon className={`h-4 w-4 ${selectedConfig.color}`} />; })()}
                {selectedConfig.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{selectedConfig.description}</p>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Settimana</label>
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => setWeekStart(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Store</label>
                  <div className="h-9 rounded-lg border border-input bg-secondary/50 px-3 flex items-center text-sm text-muted-foreground">
                    {activeStore?.name ?? "Nessuno store"}
                  </div>
                </div>
              </div>

              {["propose_schedule", "suggest_modifications", "partial_regen"].includes(selectedFeature) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Note per l'AI (opzionale)</label>
                  <Textarea
                    placeholder="Es. Preferisci turni lunghi per la sala, massimizza spezzati in cucina…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              <Button
                onClick={handleRun}
                disabled={loading || !activeStore?.id}
                className="w-full sm:w-auto gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Elaborazione AI…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Esegui</>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card className="p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Risultato
                  {!result.error && <Badge className="ml-auto bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">Completato</Badge>}
                </CardTitle>
              </CardHeader>
              <Separator className="mb-3" />
              <CardContent className="p-0">
                <ResultView result={result} />
              </CardContent>
            </Card>
          )}

          {!result && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border">
              <Sparkles className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Seleziona una funzione e clicca <strong>Esegui</strong></p>
              <p className="text-xs text-muted-foreground/60 mt-1">Richiede chiave API AI configurata nel progetto Supabase</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
