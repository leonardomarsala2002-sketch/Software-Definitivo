
-- Add 'archived' to the shift_status enum
ALTER TYPE public.shift_status ADD VALUE IF NOT EXISTS 'archived';
