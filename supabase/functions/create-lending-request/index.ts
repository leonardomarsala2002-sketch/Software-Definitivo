import { serve } from "std/server";
import { supabaseClient as supabase } from "../_shared/supabase.ts";

serve(async (req) => {
  const body = await req.json();
  const { proposer_store_id, receiver_store_id, proposer_user_id, target_user_id, date, start_time, end_time, reason } =
    body;

  const { data, error } = await supabase.from("lending_requests").insert([
    {
      proposer_store_id,
      receiver_store_id,
      proposer_user_id,
      target_user_id,
      date,
      start_time,
      end_time,
      reason,
      status: "pending",
    },
  ]);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  // TODO: notifica l'admin ricevente

  return new Response(JSON.stringify({ ok: true, data: data?.[0] }), { status: 200 });
});
