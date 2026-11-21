-- R4 part 1: enum values. ALTER TYPE ... ADD VALUE must be committed before the new values are used,
-- so these live in their own migration (same pattern as the R1 enum additions).
alter type public.lineage_type add value if not exists 'item_progress';
alter type public.lineage_type add value if not exists 'ownership_transferred';
