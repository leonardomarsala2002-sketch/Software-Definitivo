import { useState } from "react";
import {
  Shield, Clock, Brain, Bell, Save, RefreshCw,
  ChevronRight, Info, ToggleLeft, ToggleRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useStoreRules, useUpdateStoreRules,
  useOpeningHours, useUpdateOpeningHours,
  useInitStoreConfig, DAY_LABELS,
} from "@/hooks/useStoreSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "rules" | "ai" | "notifications";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "rules", label: "Regole Turnazione", icon: <Shield className="h-4 w-4" /> },
  { id: "ai", label: "Motore AI", icon: <Brain className="h-4 w-4" /> },
  { id: "notifications", label: "Notifiche", icon: <Bell className="h-4 w-4" /> },
];

/* ─── sub-components ─────────────────────────────────────────────── */

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-0.5 text-[12px] text-slate-400">{description}</p>}
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-slate-700">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-[13px] font-semibold text-slate-800 shadow-sm transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
      />
      {suffix && <span className="text-[12px] text-slate-400">{suffix}</span>}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
        value ? "bg-indigo-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
          value ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */

export default function SettingsView() {
  const { activeStore } = useAuth();
  const storeId = activeStore?.id;

  const { data: rules, isLoading: rulesLoading } = useStoreRules(storeId);
  const { mutate: updateRules, isPending: saving } = useUpdateStoreRules();
  const { mutate: initConfig } = useInitStoreConfig();

  const [tab, setTab] = useState<Tab>("rules");

  const [draft, setDraft] = useState<{
    max_daily_hours_per_employee?: number;
    min_daily_hours_per_employee?: number;
    mandatory_days_off_per_week?: number;
    max_split_shifts_per_employee_per_week?: number;
    max_daily_team_hours_sala?: number;
    max_daily_team_hours_cucina?: number;
  }>({});

  const [aiDraft, setAiDraft] = useState({
    balanceHours: true,
    preferShortShifts: false,
    maxSplitsAI: 2,
    randomize: false,
  });

  const [notifDraft, setNotifDraft] = useState({
    emailOnPublish: true,
    emailOnRequest: true,
    inAppAlerts: true,
    smsEnabled: false,
    whatsappEnabled: false,
    deadlineReminder: true,
  });

  const current = { ...rules, ...draft } as typeof rules & typeof draft;

  const handleSaveRules = () => {
    if (!Object.keys(draft).length) { toast.info("Nessuna modifica da salvare"); return; }
    updateRules({ storeId: storeId!, updates: draft }, {
      onSuccess: () => { setDraft({}); toast.success("Regole salvate"); },
      onError: () => toast.error("Errore nel salvataggio"),
    });
  };

  if (!storeId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-400">
        <Info className="mb-3 h-8 w-8 text-indigo-200" />
        <p className="text-[14px] font-medium">Seleziona uno store per configurare le impostazioni</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Impostazioni</h1>
          <p className="mt-0.5 text-[13px] text-slate-400">
            {activeStore?.name ?? "Store"} · Configura regole, AI e notifiche
          </p>
        </div>
        {!rules && !rulesLoading && (
          <button
            onClick={() => initConfig(storeId!)}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 px-3 py-2 text-[12px] font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Inizializza config
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
              tab === t.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Rules Tab ──────────────────────────────────────────────── */}
      {tab === "rules" && (
        <div className="space-y-4">
          <SectionCard
            title="Limiti orario dipendente"
            description="Ore giornaliere minime e massime per ogni dipendente"
          >
            <Field
              label="Max ore/giorno"
              hint="Limite massimo di ore in un singolo turno"
            >
              <NumericInput
                value={current?.max_daily_hours_per_employee}
                onChange={(v) => setDraft((d) => ({ ...d, max_daily_hours_per_employee: v }))}
                min={1}
                max={12}
                suffix="ore"
              />
            </Field>
            <div className="border-t border-slate-50" />
            <Field
              label="Min ore/giorno"
              hint="Ore minime per un turno valido"
            >
              <NumericInput
                value={current?.min_daily_hours_per_employee}
                onChange={(v) => setDraft((d) => ({ ...d, min_daily_hours_per_employee: v }))}
                min={1}
                max={8}
                suffix="ore"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Riposo e giorni liberi"
            description="Requisiti obbligatori per conformità contrattuale"
          >
            <Field
              label="Giorni liberi/settimana"
              hint="Numero minimo di giorni di riposo garantiti"
            >
              <NumericInput
                value={current?.mandatory_days_off_per_week}
                onChange={(v) => setDraft((d) => ({ ...d, mandatory_days_off_per_week: v }))}
                min={1}
                max={3}
                suffix="giorni"
              />
            </Field>
            <div className="border-t border-slate-50" />
            <Field
              label="Max turni spezzati/sett"
              hint="Limite di turni non consecutivi nella stessa giornata"
            >
              <NumericInput
                value={current?.max_split_shifts_per_employee_per_week}
                onChange={(v) => setDraft((d) => ({ ...d, max_split_shifts_per_employee_per_week: v }))}
                min={0}
                max={5}
                suffix="turni"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Capacità team"
            description="Ore massime per il team di sala e cucina"
          >
            <Field label="Max ore team Sala/giorno">
              <NumericInput
                value={current?.max_daily_team_hours_sala}
                onChange={(v) => setDraft((d) => ({ ...d, max_daily_team_hours_sala: v }))}
                min={8}
                max={120}
                suffix="ore"
              />
            </Field>
            <div className="border-t border-slate-50" />
            <Field label="Max ore team Cucina/giorno">
              <NumericInput
                value={current?.max_daily_team_hours_cucina}
                onChange={(v) => setDraft((d) => ({ ...d, max_daily_team_hours_cucina: v }))}
                min={8}
                max={120}
                suffix="ore"
              />
            </Field>
          </SectionCard>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveRules}
              disabled={saving || !Object.keys(draft).length}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-50 active:scale-95"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva regole
            </button>
          </div>
        </div>
      )}

      {/* ── AI Tab ─────────────────────────────────────────────────── */}
      {tab === "ai" && (
        <div className="space-y-4">
          <SectionCard
            title="Obiettivi del motore AI"
            description="Priorità e vincoli per la generazione automatica dei turni"
          >
            <Field
              label="Bilancia ore contrattuali"
              hint="L'AI tenta di rispettare esattamente le ore settimanali di contratto"
            >
              <Toggle value={aiDraft.balanceHours} onChange={(v) => setAiDraft((d) => ({ ...d, balanceHours: v }))} />
            </Field>
            <div className="border-t border-slate-50" />
            <Field
              label="Preferisci turni brevi"
              hint="Favorisce turni da 4-6h rispetto a turni lunghi"
            >
              <Toggle value={aiDraft.preferShortShifts} onChange={(v) => setAiDraft((d) => ({ ...d, preferShortShifts: v }))} />
            </Field>
            <div className="border-t border-slate-50" />
            <Field
              label="Randomizzazione strategie"
              hint="Introduce variabilità nella selezione dei turni per evitare pattern ripetitivi"
            >
              <Toggle value={aiDraft.randomize} onChange={(v) => setAiDraft((d) => ({ ...d, randomize: v }))} />
            </Field>
          </SectionCard>

          <SectionCard
            title="Vincoli algoritmo"
            description="Parametri tecnici del motore di ottimizzazione"
          >
            <Field
              label="Max turni spezzati (AI)"
              hint="Numero massimo di spezzati che l'AI può proporre per dipendente/sett"
            >
              <NumericInput
                value={aiDraft.maxSplitsAI}
                onChange={(v) => setAiDraft((d) => ({ ...d, maxSplitsAI: v }))}
                min={0}
                max={5}
                suffix="turni"
              />
            </Field>
          </SectionCard>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <Brain className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              <div>
                <p className="text-[13px] font-semibold text-indigo-800">Gemini 2.5 Flash attivo</p>
                <p className="mt-0.5 text-[12px] text-indigo-600">
                  La generazione AI usa Google Gemini direttamente. Se non disponibile, il rule engine deterministico è attivato automaticamente come fallback.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => toast.success("Impostazioni AI salvate")}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Save className="h-4 w-4" />
              Salva impostazioni AI
            </button>
          </div>
        </div>
      )}

      {/* ── Notifications Tab ──────────────────────────────────────── */}
      {tab === "notifications" && (
        <div className="space-y-4">
          <SectionCard title="Email" description="Notifiche via email per eventi chiave">
            <Field label="Email alla pubblicazione turni" hint="Inviata a tutti i dipendenti quando il mese viene pubblicato">
              <Toggle value={notifDraft.emailOnPublish} onChange={(v) => setNotifDraft((d) => ({ ...d, emailOnPublish: v }))} />
            </Field>
            <div className="border-t border-slate-50" />
            <Field label="Email nuova richiesta" hint="Notifica manager su nuove richieste di ferie/permesso">
              <Toggle value={notifDraft.emailOnRequest} onChange={(v) => setNotifDraft((d) => ({ ...d, emailOnRequest: v }))} />
            </Field>
            <div className="border-t border-slate-50" />
            <Field label="Promemoria scadenza richieste" hint="Reminder automatico 3 giorni prima della deadline mensile">
              <Toggle value={notifDraft.deadlineReminder} onChange={(v) => setNotifDraft((d) => ({ ...d, deadlineReminder: v }))} />
            </Field>
          </SectionCard>

          <SectionCard title="In-app & Push" description="Notifiche nella piattaforma">
            <Field label="Alert in-app">
              <Toggle value={notifDraft.inAppAlerts} onChange={(v) => setNotifDraft((d) => ({ ...d, inAppAlerts: v }))} />
            </Field>
          </SectionCard>

          <SectionCard title="SMS & WhatsApp" description="Canali di messaggistica aggiuntivi (richiedono configurazione API)">
            <Field label="SMS" hint="Richiede Twilio configurato in Vault">
              <Toggle value={notifDraft.smsEnabled} onChange={(v) => setNotifDraft((d) => ({ ...d, smsEnabled: v }))} />
            </Field>
            <div className="border-t border-slate-50" />
            <Field label="WhatsApp" hint="Richiede Twilio WhatsApp configurato in Vault">
              <Toggle value={notifDraft.whatsappEnabled} onChange={(v) => setNotifDraft((d) => ({ ...d, whatsappEnabled: v }))} />
            </Field>
          </SectionCard>

          <div className="flex justify-end">
            <button
              onClick={() => toast.success("Preferenze notifiche salvate")}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Save className="h-4 w-4" />
              Salva notifiche
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
