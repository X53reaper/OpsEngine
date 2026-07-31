-- Safari Zetu Ops Engine — Feedback & Code Fix Pipeline
-- Run after 001_initial_schema.sql

-- ── FEEDBACK INGESTION ────────────────────────────────────────
-- Reviews, suggestions, bug reports from tourists and operators
CREATE TABLE IF NOT EXISTS feedback_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL CHECK (source IN ('tourist_review','operator_feedback','support_ticket','app_store','social_media','manual')),
    source_id TEXT,  -- external ID from review platform
    author_name TEXT,
    author_email TEXT,
    author_type TEXT CHECK (author_type IN ('tourist','operator','visitor','unknown')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    category TEXT NOT NULL CHECK (category IN ('bug','ux_issue','feature_request','content_error','performance','design','positive','other')),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical','high','medium','low')),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    page_url TEXT,       -- which page the feedback relates to
    screenshot_url TEXT,  -- if user attached screenshot
    sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative','urgent')),
    ai_summary TEXT,     -- AI-generated summary
    ai_actionable_items JSONB,  -- AI-extracted specific fixes needed
    status TEXT DEFAULT 'new' CHECK (status IN ('new','triaged','fix_in_progress','fix_ready','verified','deployed','dismissed')),
    assigned_to TEXT DEFAULT 'ai',  -- 'ai' or developer name
    fix_pr_url TEXT,     -- link to the fix branch/PR
    fix_commit_hash TEXT,
    verified_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feedback_status ON feedback_log(status);
CREATE INDEX idx_feedback_category ON feedback_log(category);
CREATE INDEX idx_feedback_severity ON feedback_log(severity);
CREATE INDEX idx_feedback_created ON feedback_log(created_at DESC);

-- ── CODE FIX ATTEMPTS ─────────────────────────────────────────
-- Tracks each AI-attempted fix
CREATE TABLE IF NOT EXISTS code_fix_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    feedback_id UUID REFERENCES feedback_log(id),
    fix_type TEXT NOT NULL CHECK (fix_type IN ('bug_fix','ux_improvement','content_update','performance_optimization','design_tweak')),
    files_changed TEXT[],  -- list of files modified
    branch_name TEXT NOT NULL,
    commit_hash TEXT,
    pr_url TEXT,
    ai_model_used TEXT,
    ai_tokens_used INTEGER,
    ai_cost_usd NUMERIC(10,6),
    test_results JSONB,   -- browser test results
    test_status TEXT CHECK (test_status IN ('pending','passed','failed','partial')),
    founder_review_status TEXT DEFAULT 'pending' CHECK (founder_review_status IN ('pending','approved','rejected','needs_changes')),
    founder_notes TEXT,
    fix_summary TEXT,     -- AI-generated summary of what was changed
    before_screenshot TEXT,  -- base64 or URL
    after_screenshot TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ
);
CREATE INDEX idx_fix_feedback ON code_fix_log(feedback_id);
CREATE INDEX idx_fix_status ON code_fix_log(founder_review_status);

-- ── BROWSER TEST RESULTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS browser_test_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fix_id UUID REFERENCES code_fix_log(id),
    test_name TEXT NOT NULL,
    test_url TEXT NOT NULL,
    viewport_width INTEGER DEFAULT 1280,
    viewport_height INTEGER DEFAULT 720,
    status TEXT NOT NULL CHECK (status IN ('passed','failed','error','skipped')),
    screenshot_before TEXT,  -- before fix
    screenshot_after TEXT,   -- after fix
    console_errors TEXT[],
    network_errors TEXT[],
    visual_diff_score NUMERIC(5,2),  -- 0-100, how different screenshots are
    test_duration_ms INTEGER,
    error_message TEXT,
    tested_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_test_fix ON browser_test_log(fix_id);
CREATE INDEX idx_test_status ON browser_test_log(status);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────
CREATE TRIGGER update_feedback_log_updated_at BEFORE UPDATE ON feedback_log FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
