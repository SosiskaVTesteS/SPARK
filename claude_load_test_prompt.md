# 🚀 PROMPT FOR CLAUDE: DATABASE LOAD, SCALE & CONCURRENCY AUDIT (SPARK BETA PREPARATION)

You are a senior Principal Database Engineer and Performance Architect specializing in PostgreSQL, Supabase, and real-time frontend scalability. The SPARK platform is preparing for a closed beta test, and we need to ensure the database, API, and frontend can easily handle high load, concurrent users, and prevent race conditions.

Your mission is to perform a comprehensive audit of all database schemas, RPC functions, migrations, real-time sync scripts, and frontend data models in the ICC context, fix any performance bottlenecks, and implement structural optimizations.

---

## 🔍 AUDIT AREAS & CRITICAL CHECKS

### 1. Database Indexing & Query Plans (Supabase / Postgres)
- **Foreign Keys:** Every foreign key column must have an explicit B-tree index (Postgres does not automatically index foreign keys). Check tables: `messages`, `unlocked_contacts`, `channel_members`, `user_achievements`, `repost_claims`, `reports`, `moderation_queue`, `moderation_log`.
- **Filtered Indexes:** Verify if tables queried with filters (e.g., `ideas` with `status = 'active'`, `system_announcements` with `id = 1`) have optimized partial/conditional indexes.
- **Join Optimization:** Check if queries joining `profiles` and `ideas` on `author_id` or similar are index-backed.

### 2. Transaction Integrity & Race Condition Prevention
- **Double-Spending Guards:** Audit functions modifying balances, specifically `invest_in_idea` and `unlock_contact`. Ensure they use strict locking (`SELECT ... FOR UPDATE`) or atomic updates to prevent double-spending under concurrent API calls.
- **Conflict Handling:** Ensure `INSERT` statements under high concurrent writes use correct `ON CONFLICT` resolution instead of throwing raw database errors.

### 3. Row Level Security (RLS) Performance Overhead
- **Subquery Scans:** Audit RLS policies. Policies that check admin status or user credentials using subqueries (e.g. `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)`) can cause a full table scan for *every* row evaluated in a `SELECT`.
- **Optimization:** Check if policies can be rewritten to use security-definer helper functions or Postgres session variables (`auth.jwt()`) to cache access checks.

### 4. Real-time Subscription & Polling Scalability
- **Realtime Channels:** Check how Supabase Realtime is structured in `assets/js/chats-engine.js` and `assets/js/app.js`. Having every client subscribe to a broad table wildcard (like `messages` without filters) will crash the client and overload the DB under high concurrency.
- **Row-level Realtime Filters:** Ensure Realtime subscriptions use specific row/channel filters (e.g. `channel_id=eq.X`) to minimize websocket traffic.

### 5. Rate Limiting, Abuse & Token Quota Prevention
- **Edge Functions:** Review rate limits on verification mailings, OTP checks, and content moderation calls.
- **AI API Quotas:** The Content Moderation flow calls Gemini API. Under high concurrent reports/posts, we might hit rate limits. Ensure there is a queue mechanism or graceful retry handling.
- **Local Storage Limits:** Ensure caching of DMs and messages does not exceed the browser's 5MB LocalStorage quota or lead to slow page loads.

---

## 🛠 STEPS FOR THE AUDIT

### STEP 1: Scan all migrations and JS files
- Analyze all files in `supabase/migrations/` and all scripts in `assets/js/` to build a mental map of execution paths, queries, and mutations.

### STEP 2: Generate & Apply Migration `20260605000003_scaling_and_indexing_fixes.sql`
Create a new migration file that addresses database-level issues:
- Add missing B-tree indexes on all foreign key columns.
- Optimize index coverage for common filters (e.g. status, timestamps).
- Add or improve locking/concurrency controls in RPC functions (`invest_in_idea`, `unlock_contact`).
- Optimize slow RLS policies to prevent nested-loop scans.

### STEP 3: Apply Frontend Optimizations
- Optimize event listeners in `assets/js/app.js` and `assets/js/chats-engine.js` (add proper debouncing/throttling).
- Optimize local storage cache mechanisms.
- Tune Supabase Realtime subscriptions to use narrow channel filters instead of global table listens.

---

## 📤 EXPECTED OUTPUT FORMAT

Your output must contain:

1. **Bottlenecks Identified:** A detailed list of potential issues (indexes, locking, RLS, real-time) categorized by severity (Critical, High, Medium).
2. **Database Fixes (SQL Migration):** The exact SQL code of the migration `20260605000003_scaling_and_indexing_fixes.sql` applied to the project.
3. **Frontend Changes Applied:** The diff of JS files optimized for performance and rate limits.
4. **Verification Plan:** Step-by-step instructions to verify scalability (e.g., using pgbench or manual verification).

Be extremely rigorous. Write production-ready code. Solve the problems directly in the files.
