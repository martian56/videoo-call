# Database Migration Guide

This guide will help you set up and run database migrations using Alembic.

## Prerequisites

1. PostgreSQL database (Neon.tech or local)
2. `DATABASE_URL` configured in `.env` file

## Setup

1. **Configure your `.env` file:**
   ```env
   DATABASE_URL=postgresql://user:password@host:port/database
   ```

2. **The `alembic.ini` file is already configured** - it will automatically use your `DATABASE_URL` from the `.env` file.

## Running Migrations

### 1. Create Initial Migration

```bash
cd backend
alembic revision --autogenerate -m "Initial migration"
```

This will create a migration file in `alembic/versions/` with all your models.

### 2. Review the Migration

Before applying, review the generated migration file to ensure it's correct:

```bash
# View the migration file
cat alembic/versions/XXXX_initial_migration.py
```

### 3. Apply the Migration

```bash
alembic upgrade head
```

This will create all the tables in your database.

## Common Commands

### Create a new migration
```bash
alembic revision --autogenerate -m "Description of changes"
```

### Apply all pending migrations
```bash
alembic upgrade head
```

### Rollback one migration
```bash
alembic downgrade -1
```

### Rollback to a specific revision
```bash
alembic downgrade <revision_id>
```

### View current database revision
```bash
alembic current
```

### View migration history
```bash
alembic history
```

### Show SQL for a migration (without applying)
```bash
alembic upgrade head --sql
```

## Troubleshooting

### Issue: "Target database is not up to date"

If you get this error, it means your database schema doesn't match the migrations:

1. Check current revision: `alembic current`
2. Check expected revision: `alembic heads`
3. Apply migrations: `alembic upgrade head`

### Issue: "Can't locate revision identified by..."

This means your migration history is out of sync:

1. Check your database: `alembic current`
2. If needed, stamp the database: `alembic stamp head`

### Issue: Async database URL errors

The `env.py` file is configured to automatically convert `postgresql://` to `postgresql+asyncpg://` for async operations. Make sure your `DATABASE_URL` starts with `postgresql://`.

## Database Schema

After running migrations, you'll have these tables:

- **meetings** - Stores meeting information
- **participants** - Tracks meeting participants
- **meeting_logs** - Logs all meeting events

## Notes

- The `alembic.ini` file has a placeholder URL, but `env.py` overrides it with your `.env` settings
- All migrations use async SQLAlchemy
- The database connection is automatically configured from your `.env` file

