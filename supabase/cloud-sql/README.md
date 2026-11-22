# Run these in the Supabase SQL Editor

Open your project at supabase.com, then **SQL Editor, New query**. For each file below, in this order:
paste the whole file, click **Run**, wait for "Success", then do the next one. Do not combine files.

| Step | File |
|---|---|
| 01 | `01_schema.sql` |
| 02 | `02_admin.sql` |
| 03 | `03_r1_enum_additions.sql` |
| 04 | `04_r1_access_model.sql` |
| 05 | `05_r4_enum_additions.sql` |
| 06 | `06_r4_flows.sql` |
| 07 | `07_r5_no_advisor.sql` |
| 08 | `08_r5_enum_additions.sql` |
| 09 | `09_r5_moderation_legal.sql` |
| 10 | `10_r6_admin_v2.sql` |
| 11 | `11_r7_production.sql` |
| optional | `99_OPTIONAL_demo_data.sql` (demo data, skip it for a real site) |

Then make yourself the first admin (replace the email with the one you signed up with):

```sql
select public.promote_admin('you@example.com');
```

These files are generated from `supabase/migrations` by `node scripts/build-cloud-sql.mjs`. The migrations stay the source of truth.
