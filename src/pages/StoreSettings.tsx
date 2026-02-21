import { useState, useMemo } from "react";
import { Settings, Plus, Pencil, Clock, Users, ShieldCheck, CalendarClock, LayoutGrid } from "lucide-react";
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
  useInitStoreConfig,
  useUpdateStoreRules,
  useUpdateOpeningHours,
  useSaveCoverage,
  DAY_LABELS,
  generateSlots,
} from "@/hooks/useStoreSettings";
import RulesModal from "@/components/store-settings/RulesModal";
import OpeningHoursModal from "@/components/store-settings/OpeningHoursModal";
import CoverageModal from "@/components/store-settings/CoverageModal";

function SettingsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
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

  const initConfig = useInitStoreConfig();
  const updateRules = useUpdateStoreRules();
  const updateHours = useUpdateOpeningHours();
  const saveCoverage = useSaveCoverage();

  const [rulesOpen, setRulesOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);

  const isLoading = loadingRules || loadingHours || loadingCoverage;
  const readOnly = role === "employee";
  const hasConfig = !!rules;

  // Summaries
  const hoursSummary = useMemo(() => {
    if (hours.length === 0) return "Non configurati";
    const times = hours.map((h) => `${h.opening_time.slice(0, 5)}–${h.closing_time.slice(0, 5)}`);
    const unique = [...new Set(times)];
    if (unique.length === 1) return `Lun–Dom ${unique[0]}`;
    return `Lun–Dom ${hours[0].opening_time.slice(0, 5)}–${hours[0].closing_time.slice(0, 5)} (variabile)`;
  }, [hours]);

  const totalSlots = useMemo(() => {
    return coverage.length;
  }, [coverage]);

  return (
    <div>
      <PageHeader
        title="Impostazioni Store"
        subtitle={
          activeStore
            ? `Configurazione per ${activeStore.name}`
            : "Regole, orari e copertura dello store"
        }
      />

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
              <Button
                onClick={() => storeId && initConfig.mutate(storeId)}
                disabled={initConfig.isPending}
                size="lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crea configurazione iniziale
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Regole Team */}
            <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Regole Team</h3>
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRulesOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max ore Sala</span>
                    <span className="font-medium">{(rules as any).max_daily_team_hours_sala ?? "–"} h/giorno</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max ore Cucina</span>
                    <span className="font-medium">{(rules as any).max_daily_team_hours_cucina ?? "–"} h/giorno</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max spezzati</span>
                    <span className="font-medium">{rules.max_split_shifts_per_employee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giorni liberi</span>
                    <span className="font-medium">{rules.mandatory_days_off_per_week}/sett.</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Orari di apertura */}
            <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <CalendarClock className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Orari Apertura</h3>
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHoursOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="text-[13px] text-muted-foreground mb-3">{hoursSummary}</p>
                <div className="flex flex-wrap gap-1.5">
                  {hours.map((h) => (
                    <Badge key={h.id} variant="secondary" className="text-[11px] font-normal">
                      {DAY_LABELS[h.day_of_week]?.slice(0, 3)} {h.opening_time.slice(0, 5)}–{h.closing_time.slice(0, 5)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Copertura minima */}
            <Card className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <LayoutGrid className="h-4 w-4 text-primary" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">Copertura Minima</h3>
                  </div>
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCoverageOpen(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[11px]">
                    {totalSlots} slot configurati
                  </Badge>
                </div>
                <p className="text-[13px] text-muted-foreground">{hoursSummary}</p>
              </CardContent>
            </Card>
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
        </>
      )}
    </div>
  );
};

export default StoreSettings;
