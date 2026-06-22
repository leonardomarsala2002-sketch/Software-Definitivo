-- Add FK from time_off_requests.user_id to profiles.id (NOT VALID skips validation
-- of existing rows so orphaned test records don't block the migration).
-- PostgREST uses this FK to enable profiles(full_name) embedded joins in API queries.
ALTER TABLE public.time_off_requests
  ADD CONSTRAINT time_off_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
  NOT VALID;
