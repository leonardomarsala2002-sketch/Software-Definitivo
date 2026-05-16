import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-up">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
      <div className="text-slate-400 [&>svg]:h-7 [&>svg]:w-7">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.4" />
            <path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
    <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
    <p className="max-w-xs text-sm text-slate-500 leading-relaxed">{description}</p>
    {action && (
      <Button className="mt-5" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
