# Database Migration Rules

## Local-First Migrations

All database schema changes (DDL) **MUST** be done through local SQL migration
files in `supabase/migrations/`, never through the Supabase MCP tool or
dashboard directly.

### ✅ DO

- Create `.sql` migration files in `supabase/migrations/` for any schema change
  (tables, columns, triggers, functions, indexes, RLS policies, enums, etc.)
- Use the Supabase MCP tool **only for reading** (querying data, checking
  schema, listing tables, inspecting logs, etc.)
- Run `npm run db:push` to apply local migrations to the remote database
- Run `npm run db:sync-local` to regenerate WatermelonDB schema and types from
  the latest migration

### ❌ DON'T

- Use the Supabase MCP tool's `apply_migration` or `execute_sql` for DDL changes
  (CREATE, ALTER, DROP, etc.)
- Make schema changes directly in the Supabase dashboard
- Use `execute_sql` for DML that should be part of a migration (INSERT seed
  data, UPDATE schema-related data, etc.)

### Why

Using the MCP tool or dashboard for schema changes causes the remote migration
history to diverge from local files, leading to:

- `db push` failures due to version mismatches
- Lost migration history that can't be version-controlled
- Painful manual repair of the migration history table
- Team collaboration issues when multiple developers are involved

### Migration File Naming

Follow the existing numbering convention:

```
supabase/migrations/023_descriptive_name.sql
```

### Workflow

1. Write the SQL migration file locally
2. Run `npm run db:push` to apply to remote
3. Run `npm run db:sync-local` to regenerate WatermelonDB schema/types
4. Commit both the migration file and generated schema changes
