-- Safari Zetu Ops Engine — Fix Schema Conflicts and Column Mismatches
-- Addresses: outreach_log conflict, content_queue conflict,
--            competitor_content columns, content_performance columns

-- ── FIX 1: DROP CONFLICTING TABLES ──────────────────────────
-- Migrations 003 and 004 defined different schemas for outreach_log and content_queue.
-- Since IF NOT EXISTS silently skipped them, the 001 versions are in use.
-- Drop the 003/004 definitions so they don't cause confusion.
-- NOTE: These tables were never created (IF NOT EXISTS skipped), so DROP IF EXISTS is safe.

DROP TABLE IF EXISTS outreach_log CASCADE;
DROP TABLE IF EXISTS content_queue CASCADE;

-- ── RECREATE outreach_log (schema from 001, used by all code) ──
CREATE TABLE outreach_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','partner','operator','tourist')),
    entity_id UUID NOT NULL,
    email_to TEXT NOT NULL,
    email_subject TEXT NOT NULL,
    email_body TEXT NOT NULL,
    email_type TEXT NOT NULL,
    resend_message_id TEXT,
    status TEXT DEFAULT 'drafted' CHECK (status IN ('drafted','pending_approval','approved','sent','delivered','opened','replied','bounced','failed')),
    drafted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    agent_name TEXT,
    tokens_used INTEGER,
    model_used TEXT,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_outreach_entity ON outreach_log(entity_type, entity_id);
CREATE INDEX idx_outreach_status ON outreach_log(status);

-- ── RECREATE content_queue (schema from 001, used by all code) ──
CREATE TABLE content_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL CHECK (content_type IN ('blog_article','instagram_caption','linkedin_post','x_thread','operator_spotlight','destination_guide','newsletter','social_post')),
    title TEXT,
    topic TEXT NOT NULL,
    keywords TEXT[],
    target_destination TEXT,
    draft_content TEXT,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued','generating','draft_ready','pending_approval','approved','published','rejected')),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    published_url TEXT,
    word_count INTEGER,
    tokens_used INTEGER,
    model_used TEXT,
    cost_usd NUMERIC(10,6),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_status ON content_queue(status);
CREATE INDEX idx_content_type ON content_queue(content_type);

-- ── FIX 2: ADD MISSING COLUMNS TO competitor_content ────────
-- competitor-ad-agent.ts uses columns not in migration 007
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS competitor_name VARCHAR(255);
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS winning_patterns JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS audience_angles JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS copy_frameworks JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS visual_brief TEXT;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS compliance_risks JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS adaptation_plan JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS content_type VARCHAR(50);
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS content_data JSONB;
ALTER TABLE competitor_content ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill competitor_name from competitor if both exist
UPDATE competitor_content SET competitor_name = competitor WHERE competitor_name IS NULL AND competitor IS NOT NULL;

-- ── FIX 3: ADD MISSING COLUMNS TO content_performance ───────
-- newsletter-agent, seo-research-agent, seo-content-factory use columns not in migration 007
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS content_body TEXT;
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS model_used TEXT;
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,6);
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS source_urls TEXT[];
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS facts_to_check TEXT[];
ALTER TABLE content_performance ADD COLUMN IF NOT EXISTS review_flags TEXT[];
