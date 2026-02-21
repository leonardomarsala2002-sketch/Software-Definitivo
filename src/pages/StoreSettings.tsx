import { Settings, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
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
} from "@/hooks/useStoreSettings";
import GeneralRulesSection from "@/components/store-settings/GeneralRulesSection";
import OpeningHoursSection from "@/components/store-settings/OpeningHoursSection";
import CoverageSection from "@/components/store-settings/CoverageSection";

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
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

  const isLoading = loadingRules || loadingHours || loadingCoverage;
  const readOnly = role === "employee";
  const hasConfig = !!rules;

  return (
    <div>
      <PageHeader
        title="Impostazioni Store"
        subtitle={
          activeStore
            ? `Configurazione regole e copertura per ${activeStore.name}`
            : "Regole dei turni, coperture e configurazione sala/cucina"
        }
      />

      {isLoading ? (
        <SettingsSkeleton />
      ) : !hasConfig ? (
        <div>
          <EmptyState
            icon={<Settings className="h-6 w-6" />}
            title="Nessuna configurazione"
            description="Configura le regole dello store per abilitare la generazione automatica dei turni."
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
        <div className="space-y-6">
          <GeneralRulesSection
            rules={rules}
            onSave={(updates) => storeId && updateRules.mutate({ storeId, updates })}
            isSaving={updateRules.isPending}
            readOnly={readOnly}
          />

          {hours.length > 0 && (
            <OpeningHoursSection
              hours={hours}
              onSave={(h) => storeId && updateHours.mutate({ storeId, hours: h })}
              isSaving={updateHours.isPending}
              readOnly={readOnly}
            />
          )}

          {hours.length > 0 && (
            <CoverageSection
              hours={hours}
              coverage={coverage}
              onSave={(rows) => storeId && saveCoverage.mutate({ storeId, rows })}
              isSaving={saveCoverage.isPending}
              readOnly={readOnly}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default StoreSettings;
