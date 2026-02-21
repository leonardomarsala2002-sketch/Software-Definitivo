import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const EmptyState = ({ icon, title, description }: EmptyStateProps) => (
  <Card className="border border-border/60 shadow-sm">
    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mb-1.5 text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

export default EmptyState;
