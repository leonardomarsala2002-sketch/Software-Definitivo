import { serve } from "std/server";
import { supabaseClient as supabase } from "../_shared/supabase.ts";

serve(async (req) => {
  const { lending_request_id, sender_user_id, message } = await req.json();

  const { error } = await supabase.from("lending_request_messages").insert([
    {
      lending_request_id,
      sender_user_id,
      message,
    },
  ]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  // TODO: notifica all'altro admin

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
