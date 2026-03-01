import { useState, useMemo } from "react";
import {
  Settings,
  Plus,
  Pencil,
  ShieldCheck,
  CalendarClock,
  LayoutGrid,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  useStoreRules,
  useOpeningHours,
  useCoverageRequirements,
  useAllowedTimes,
  useInitStoreConfig,
  useUpdateStoreRules,
  useUpdateOpeningHours,
  useSaveCoverage,
  useSaveAllowedTimes,
  DAY_LABELS,
} from "@/hooks/useStoreSettings";
import RulesModal from "@/components/store-settings/RulesModal";
import OpeningHoursModal from "@/components/store-settings/OpeningHoursModal";
import CoverageModal from "@/components/store-settings/CoverageModal";
import AllowedTimesModal from "@/components/store-settings/AllowedTimesModal";

const isPreview =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname === "localhost");

const ENGINE_RULES = [
  { label: "Tolleranza ore contrattuali", desc: "Il motore accetta deviazioni entro ±5h dal contratto settimanale senza penalità. Oltre viene applicata una penalità di -30/h per forzare il rientro." },
  { label: "Compensazione automatica", desc: "Se l'admin accetta una deviazione ±5h, la differenza viene compensata automaticamente nella settimana successiva." },
  { label: "Riposo minimo 11h", desc: "Tra la fine di un turno e l'inizio del successivo devono passare almeno 11 ore (vincolo inviolabile)." },
  { label: "Durata minima turno", desc: "Ogni turno deve durare almeno 3 ore." },
  { label: "40 tentativi di generazione", desc: "Il motore esegue fino a 40 iterazioni per trovare la soluzione ottimale." },
  { label: "Fallback se fallisce", desc: "Se la generazione fallisce: 1) aumenta gli spezzati di +1 a testa, 2) propone deviazioni ±5h con motivazione." },
  { label: "Cutoff richieste", desc: "Le richieste inviate dopo il giovedì valgono dalla settimana successiva." },
  { label: "Generazione automatica", desc: "Ogni giovedì alle 03:00 UTC viene generata la bozza dei turni per la settimana ISO successiva." },
  { label: "Prestiti inter-store", desc: "L'unico tipo di suggerimento mostrato in UI riguarda i prestiti tra store (mancanza personale o surplus ≥3h)." },
  { label: "Merge turni contigui", desc: "Turni adiacenti dello stesso dipendente nello stesso giorno vengono automaticamente uniti in un unico turno." },
  { label: "Rispetto orari consentiti", desc: "Il motore usa esclusivamente gli orari di entrata/uscita configurati nello store. Non crea orari dinamici." },
  { label: "Copertura min-max", desc: "Il motore riempie prima fino al minimo richiesto, poi continua fino al massimo se i dipendenti hanno ore contrattuali da completare." },
];

function SettingsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

const StoreSettings = () => {
  const { activeStore, role } = useAuth();
  const storeId = activeStore?.id;

  const { data: rules, isLoading: loadingRules } = useStoreRules(storeId);
  const { data: hours = [], isLoading: loadingHours } = useOpeningHours(storeId);
  const { data: coverage = [], isLoading: loadingCoverage } = useCoverageRequirements(storeId);
  const { data: allowedTimes = [], isLoading: loadingAllowed } = useAllowedTimes(storeId);

  const initConfig = useInitStoreConfig();
  const updateRules = useUpdateStoreRules();
  const updateHours = useUpdateOpeningHours();
  const saveCoverage = useSaveCoverage();
  const saveAllowed = useSaveAllowedTimes();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [allowedOpen, setAllowedOpen] = useState(false);

  const isLoading = loadingRules || loadingHours || loadingCoverage || loadingAllowed;
  const readOnly = role === "employee";
  const hasConfig = !!rules;

  // Readiness check
  const isReady = hasConfig && hours.length > 0 && coverage.length > 0;

  // Summaries
  const hoursSummary = useMemo(() => {
    if (hours.length === 0) return "Non configurati";
    const times = hours.map((h) => `${h.opening_time.slice(0, 5)}–${h.closing_time.slice(0, 5)}`);
    const unique = [...new Set(times)];
    if (unique.length === 1) return `Lun–Dom ${unique[0]}`;
    return `${hours[0].opening_time.slice(0, 5)}–${hours[0].closing_time.slice(0, 5)} (variabile)`;
  }, [hours]);

  const rulesSummary = useMemo(() => {
    if (!rules) return "Non configurate";
    const r = rules as any;
    return `Sala ${r.max_team_hours_sala_per_week ?? "–"}h · Cucina ${r.max_team_hours_cucina_per_week ?? "–"}h / sett.`;
  }, [rules]);

  const genEnabled = rules?.generation_enabled ?? false;

  const cards = [
    {
      title: "Regole Team",
      icon: ShieldCheck,
      summary: rulesSummary,
      configured: hasConfig,
      onEdit: () => setRulesOpen(true),
      extraBadge: hasConfig ? (genEnabled ? { label: "Auto ✓", variant: "default" as const, className: "bg-success text-success-foreground" } : { label: "Manuale", variant: "secondary" as const, className: "" }) : undefined,
    },
    {
      title: "Orari Apertura",
      icon: CalendarClock,
      summary: hoursSummary,
      configured: hours.length > 0,
      onEdit: () => setHoursOpen(true),
    },
    {
      title: "Copertura Richiesta",
      icon: LayoutGrid,
      summary: coverage.length > 0 ? `${coverage.length} slot configurati` : "Non configurata",
      configured: coverage.length > 0,
      onEdit: () => setCoverageOpen(true),
    },
    {
      title: "Entrate / Uscite",
      icon: LogIn,
      summary: allowedTimes.length > 0 ? `${allowedTimes.length} ore configurate` : "Non configurate",
      configured: allowedTimes.length > 0,
      onEdit: () => setAllowedOpen(true),
      optional: true,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Impostazioni Store"
        subtitle={activeStore ? `Configurazione per ${activeStore.name}` : "Regole, orari e copertura"}
      />

      {/* Readiness badge */}
      {hasConfig && !isLoading && (
        <div className="mb-4">
          {isReady ? (
            <Badge variant="default" className="bg-success text-success-foreground gap-1.5 text-xs px-3 py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Store pronto per generazione
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1.5 text-xs px-3 py-1">
              <AlertCircle className="h-3.5 w-3.5" /> Configurazione incompleta
            </Badge>
          )}
        </div>
      )}

      {isLoading ? (
        <SettingsSkeleton />
      ) : !hasConfig ? (
        <div>
          <EmptyState
            icon={<Settings className="h-6 w-6" />}
            title="Nessuna configurazione"
            description="Configura le regole dello store per abilitare la generazione dei turni."
          />
          {!readOnly && (
            <div className="mt-6 flex justify-center">
              <Button onClick={() => storeId && initConfig.mutate(storeId)} disabled={initConfig.isPending} size="lg">
                <Plus className="mr-2 h-4 w-4" /> Crea configurazione iniziale
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <Card
                key={card.title}
                className="border border-border bg-card shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group"
                onClick={card.onEdit}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-primary/10 p-1.5">
                        <card.icon className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {"extraBadge" in card && card.extraBadge && (
                        <Badge variant={card.extraBadge.variant} className={`text-[10px] px-1.5 py-0 ${card.extraBadge.className}`}>
                          {card.extraBadge.label}
                        </Badge>
                      )}
                      <Badge variant={card.configured ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {card.configured ? "✓" : ("optional" in card && card.optional) ? "Opzionale" : "Da fare"}
                      </Badge>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            card.onEdit();
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Modals */}
          <RulesModal
            open={rulesOpen}
            onOpenChange={setRulesOpen}
            rules={rules}
            onSave={(updates) => storeId && updateRules.mutate({ storeId, updates })}
            isSaving={updateRules.isPending}
            readOnly={readOnly}
          />
          {hours.length > 0 && (
            <OpeningHoursModal
              open={hoursOpen}
              onOpenChange={setHoursOpen}
              hours={hours}
              onSave={(h) => storeId && updateHours.mutate({ storeId, hours: h })}
              isSaving={updateHours.isPending}
              readOnly={readOnly}
            />
          )}
          {hours.length > 0 && (
            <CoverageModal
              open={coverageOpen}
              onOpenChange={setCoverageOpen}
              hours={hours}
              coverage={coverage}
              onSave={(rows) => storeId && saveCoverage.mutate({ storeId, rows: rows as any })}
              isSaving={saveCoverage.isPending}
              readOnly={readOnly}
            />
          )}
          <AllowedTimesModal
            open={allowedOpen}
            onOpenChange={setAllowedOpen}
            allowedTimes={allowedTimes.map((t) => ({
              department: t.department as "sala" | "cucina",
              kind: t.kind as "entry" | "exit",
              hour: t.hour,
              is_active: t.is_active,
            }))}
            onSave={(times) => storeId && saveAllowed.mutate({ storeId, times })}
            isSaving={saveAllowed.isPending}
            readOnly={readOnly}
          />
        </>
      )}

      {/* Engine rules card – preview only */}
      {isPreview && hasConfig && !isLoading && (
        <Card className="mt-6 border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Regole Motore (solo preview)</h3>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">DEV</Badge>
            </div>
            <ul className="space-y-2">
              {ENGINE_RULES.map((rule) => (
                <li key={rule.label} className="text-xs">
                  <span className="font-medium text-foreground">{rule.label}:</span>{" "}
                  <span className="text-muted-foreground">{rule.desc}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StoreSettings;
