ALTER TABLE public.store_coverage_requirements
ADD COLUMN max_staff_required integer DEFAULT NULL;

COMMENT ON COLUMN public.store_coverage_requirements.max_staff_required IS 'Optional max staff for variable coverage. When NULL, only min_staff_required is used as fixed value.';
