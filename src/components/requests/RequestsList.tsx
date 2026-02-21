import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { type TimeOffRequest, useDeleteRequest, useReviewRequest } from "@/hooks/useRequests";

const TYPE_LABELS: Record<string, string> = {
  full_day_off: "Giorno libero",
  morning_off: "Mattina libera",
  evening_off: "Sera libera",
  ferie: "Ferie",
  permesso: "Permesso",
  malattia: "Malattia",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  approved: "Approvata",
  rejected: "Rifiutata",
};

interface Props {
  requests: TimeOffRequest[];
  isLoading: boolean;
  profiles?: Map<string, string>; // user_id -> full_name
  isAdmin: boolean;
}

export default function RequestsList({ requests, isLoading, profiles, isAdmin }: Props) {
  const { user } = useAuth();
  const deleteReq = useDeleteRequest();
  const reviewReq = useReviewRequest();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-2">
      {requests.map((r) => {
        const isOwn = r.user_id === user?.id;
        const canDelete = isOwn && r.status === "pending";
        const canReview = isAdmin && r.status === "pending";
        const name = profiles?.get(r.user_id) ?? r.user_id.slice(0, 8);

        return (
          <div
            key={r.id}
            className="rounded-lg border border-border p-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                {isAdmin && (
                  <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                    {name}
                  </span>
                )}
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {TYPE_LABELS[r.request_type] ?? r.request_type}
                </Badge>
                <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-[10px] shrink-0">
                  {STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(r.request_date).toLocaleDateString("it-IT")}
                {r.selected_hour != null && (
                  <span className="ml-1.5 font-mono">
                    {r.request_type === "morning_off"
                      ? `fino alle ${String(r.selected_hour).padStart(2, "0")}:00`
                      : `dalle ${String(r.selected_hour).padStart(2, "0")}:00`}
                  </span>
                )}
              </p>
              {r.notes && <p className="text-[11px] text-muted-foreground truncate">{r.notes}</p>}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {canReview && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-success hover:text-success"
                    onClick={() => reviewReq.mutate({ id: r.id, status: "approved", reviewedBy: user!.id })}
                    disabled={reviewReq.isPending}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => reviewReq.mutate({ id: r.id, status: "rejected", reviewedBy: user!.id })}
                    disabled={reviewReq.isPending}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteReq.mutate(r.id)}
                  disabled={deleteReq.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
