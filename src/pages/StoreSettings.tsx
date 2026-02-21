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

  const cards = [
    {
      title: "Regole Team",
      icon: ShieldCheck,
      summary: rulesSummary,
      configured: hasConfig,
      onEdit: () => setRulesOpen(true),
    },
    {
      title: "Orari Apertura",
      icon: CalendarClock,
      summary: hoursSummary,
      configured: hours.length > 0,
      onEdit: () => setHoursOpen(true),
    },
    {
      title: "Copertura Minima",
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
                className="border border-border/60 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
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
                      <Badge variant={card.configured ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                        {card.configured ? "✓" : card.optional ? "Opzionale" : "Da fare"}
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
              onSave={(rows) => storeId && saveCoverage.mutate({ storeId, rows })}
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
    </div>
  );
};

export default StoreSettings;
