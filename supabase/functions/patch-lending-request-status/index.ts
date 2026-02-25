import { serve } from "std/server";
import { supabaseClient as supabase } from "../_shared/supabase.ts";

serve(async (req) => {
  const { request_id, status, modifier_user_id } = await req.json();

  const { error } = await supabase
    .from("lending_requests")
    .update({
      status,
      last_modified_by: modifier_user_id,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", request_id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  // TODO: notifica all'altro admin

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
