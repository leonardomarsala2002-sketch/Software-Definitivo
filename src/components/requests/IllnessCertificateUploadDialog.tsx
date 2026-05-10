import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertCircle, Upload, FileCheck2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface Props {
  storeId: string;
  date: string;
  /** end date for the illness period, defaults to date */
  endDate?: string;
  onDone: () => void;
  onSkip?: () => void;
}

export default function IllnessCertificateUploadDialog({ storeId, date, endDate, onDone, onSkip }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File) => {
    if (!ALLOWED_MIME.includes(f.type)) {
      toast.error("Formato non supportato. Carica JPG, PNG, WEBP, HEIC o PDF.");
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      toast.error("File troppo grande. Max 10MB.");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${date}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("illness-certificates")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { error: fnError } = await supabase.functions.invoke("manage-illness-certificate", {
        body: {
          action: "submit",
          store_id: storeId,
          start_date: date,
          end_date: endDate ?? date,
          storage_path: path,
        },
      });

      if (fnError) throw fnError;

      toast.success("Certificato caricato. Il manager riceverà una notifica.");
      onDone();
    } catch (err: any) {
      toast.error(`Errore upload: ${err.message ?? "Riprova"}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <FileCheck2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80">
          Carica il certificato medico per il <strong>{date}</strong>.
          Il manager lo riceverà per la validazione.
        </p>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors p-6 cursor-pointer bg-secondary/30 hover:bg-secondary/60"
      >
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept={ALLOWED_MIME.join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <>
            <FileCheck2 className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-full bg-muted hover:bg-destructive/20 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <>
            <Upload className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Clicca o trascina il file</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC, PDF — max 10MB</p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Caricamento…</>
          ) : (
            <><Upload className="h-3.5 w-3.5 mr-1.5" />Carica certificato</>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onSkip ?? onDone}
          disabled={uploading}
        >
          {onSkip ? "Salta" : "Chiudi"}
        </Button>
      </div>
      {!onSkip && (
        <p className="text-[10px] text-center text-muted-foreground">
          Puoi caricare il certificato in un secondo momento dalla sezione Richieste.
        </p>
      )}
    </div>
  );
}
