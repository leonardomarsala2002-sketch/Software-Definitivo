-- Fix all closing_time values that end in :59 to use :00 instead
UPDATE public.store_opening_hours
SET closing_time = (LPAD(EXTRACT(HOUR FROM closing_time::time)::text, 2, '0') || ':00:00')::time
WHERE closing_time::text LIKE '%:59:%';

-- Also fix any opening_time with :59 just in case
UPDATE public.store_opening_hours
SET opening_time = (LPAD(EXTRACT(HOUR FROM opening_time::time)::text, 2, '0') || ':00:00')::time
WHERE opening_time::text LIKE '%:59:%';