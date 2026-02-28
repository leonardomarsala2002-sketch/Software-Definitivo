import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TutorialOverlay } from "./TutorialOverlay";
import { getStepsForRole } from "./tutorialSteps";

export function TutorialProvider() {
  const { user, role, isLoading } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isLoading || !user?.id || !role) return;

    // Check if user has already seen tutorial
    supabase
      .from("profiles")
      .select("has_seen_tutorial")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setChecked(true);
        if (data && !data.has_seen_tutorial) {
          setShowTutorial(true);
        }
      });
  }, [user?.id, role, isLoading]);

  const handleComplete = async () => {
    setShowTutorial(false);
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ has_seen_tutorial: true } as any)
        .eq("id", user.id);
    }
  };

  if (!showTutorial || !role || !checked) return null;

  const steps = getStepsForRole(role);

  return <TutorialOverlay steps={steps} onComplete={handleComplete} />;
}
