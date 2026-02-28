import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Trash2, Info, Users, Clock, Store, CalendarDays, MessageSquare, FileText } from "lucide-react";
import type { Appointment } from "@/hooks/useAppointments";

const CATEGORY_LABELS: Record<string, string> = {
  meeting: "Riunione", training: "Formazione", inspection: "Ispezione", event: "Evento", other: "Altro",
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "In attesa", className: "bg-amber-500/15 text-amber-600" },
  accepted: { label: "Accettato", className: "bg-primary/15 text-primary" },
  declined: { label: "Rifiutato", className: "bg-destructive/15 text-destructive" },
};

const MONTHS_IT = [
  "Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
  "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre",
];

interface AppointmentCardProps {
  appointment: Appointment;
  currentUserId?: string;
  onAccept?: (apt: Appointment) => void;
  onDecline?: (apt: Appointment) => void;
  onCancel?: (apt: Appointment) => void;
}

export function AppointmentCard({ appointment: apt, currentUserId, onAccept, onDecline, onCancel }: AppointmentCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const statusInfo = STATUS_LABELS[apt.status] ?? STATUS_LABELS.pending;
  const isCreator = currentUserId === apt.created_by;
  const isTarget = currentUserId === apt.target_user_id;
  const canCancel = isCreator && apt.status !== "declined";
  const canRespond = apt.status === "pending" && isTarget;

  const dateObj = new Date(apt.appointment_date + "T00:00:00");
  const formattedDate = `${dateObj.getDate()} ${MONTHS_IT[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  return (
    <>
      <div className="rounded-xl bg-secondary p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{apt.title}</p>
            <p className="text-xs text-muted-foreground">
              {apt.start_time?.slice(0, 5)} – {apt.end_time?.slice(0, 5)}
              {apt.store?.name && <> · {apt.store.name}</>}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${statusInfo.className}`}>
              {statusInfo.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {CATEGORY_LABELS[apt.category] ?? apt.category}
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => setShowDetail(true)}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Creator / target info */}
        {apt.target_profile?.full_name && !isTarget && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Con: {apt.target_profile.full_name}
          </p>
        )}
        {apt.creator_profile?.full_name && isTarget && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" /> Da: {apt.creator_profile.full_name}
          </p>
        )}
        {apt.description && <p className="text-xs text-foreground/70 line-clamp-2">{apt.description}</p>}

        {/* Action buttons */}
        <div className="flex gap-1.5 pt-1">
          {canRespond && onAccept && (
            <Button size="sm" variant="ghost" className="h-7 text-xs bg-primary/15 text-primary hover:bg-primary/25"
              onClick={() => onAccept(apt)}>
              <Check className="h-3.5 w-3.5 mr-1" /> Accetta
            </Button>
          )}
          {canRespond && onDecline && (
            <Button size="sm" variant="ghost" className="h-7 text-xs bg-destructive/15 text-destructive hover:bg-destructive/25"
              onClick={() => onDecline(apt)}>
              <X className="h-3.5 w-3.5 mr-1" /> Rifiuta
            </Button>
          )}
          {canCancel && onCancel && (
            <Button size="sm" variant="ghost" className="h-7 text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 ml-auto"
              onClick={() => setShowCancelConfirm(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Annulla
            </Button>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-5 w-5 text-primary" />
              {apt.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] px-1.5 py-0 border-0 font-semibold ${statusInfo.className}`}>
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {CATEGORY_LABELS[apt.category] ?? apt.category}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>{formattedDate}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{apt.start_time?.slice(0, 5)} – {apt.end_time?.slice(0, 5)}</span>
              </div>
              {apt.store?.name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Store className="h-4 w-4 shrink-0" />
                  <span>{apt.store.name}</span>
                </div>
              )}
              {apt.creator_profile?.full_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Creato da: {apt.creator_profile.full_name}</span>
                </div>
              )}
              {apt.target_profile?.full_name && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Invitato: {apt.target_profile.full_name}</span>
                </div>
              )}
            </div>

            {apt.description && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Descrizione
                </p>
                <p className="text-xs text-foreground/70 bg-secondary rounded-lg p-2">{apt.description}</p>
              </div>
            )}
            {apt.notes && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" /> Note
                </p>
                <p className="text-xs text-muted-foreground italic bg-secondary rounded-lg p-2">{apt.notes}</p>
              </div>
            )}
            {apt.decline_reason && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Motivo rifiuto
                </p>
                <p className="text-xs text-destructive/80 bg-destructive/10 rounded-lg p-2">{apt.decline_reason}</p>
              </div>
            )}
            {apt.responded_at && (
              <p className="text-[10px] text-muted-foreground">
                Risposta il: {new Date(apt.responded_at).toLocaleDateString("it-IT")} alle {new Date(apt.responded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Annulla appuntamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler annullare l'appuntamento "{apt.title}"? L'azione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Chiudi</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onCancel?.(apt);
                setShowCancelConfirm(false);
              }}
            >
              Conferma annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}