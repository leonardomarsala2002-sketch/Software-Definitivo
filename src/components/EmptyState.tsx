import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-up">
    <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f5f3ff] to-[#ede9fe] shadow-[0_4px_24px_rgba(99,91,255,0.12)]">
      <div className="text-[#635bff] [&>svg]:h-9 [&>svg]:w-9">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.4" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
    <h3 className="text-lg font-bold text-[#0f1117] mb-1.5">{title}</h3>
    <p className="max-w-xs text-sm leading-relaxed text-[#6b7280]">{description}</p>
    {action && (
      <Button className="mt-6" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
