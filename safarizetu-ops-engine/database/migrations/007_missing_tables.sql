-- Safari Zetu Ops Engine — Missing Tables
-- Fixes 3 tables queried in code but never created in migrations

-- ── CONTENT PERFORMANCE ───────────────────────────────────────
-- Tracks engagement metrics for all content across platforms
-- Used by: learning-engine.service.ts (recordEngagement, analyzePerformance)
CREATE TABLE IF NOT EXISTS content_performance (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(50) NOT NULL,
    content_type VARCHAR(50),
    memory_type VARCHAR(100),
    tone VARCHAR(50),
    topic VARCHAR(100),
    psychology_used TEXT,               -- JSON array stored as text
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    booked BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_content_performance_recorded ON content_performance(recorded_at DESC);
CREATE INDEX idx_content_performance_platform ON content_performance(platform);

-- ── PERSON PROFILES ───────────────────────────────────────────
-- Unified traveler/lead profiles for personalization
-- Used by: personalization-engine.service.ts (buildPersonProfile, saveProfile)
CREATE TABLE IF NOT EXISTS person_profiles (
    id TEXT PRIMARY KEY,               -- "person-${Date.now()}"
    email TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    company TEXT,
    role TEXT,
    location TEXT,
    interests TEXT,                    -- JSON array stored as text
    engagement_level VARCHAR(20) DEFAULT 'cold' CHECK (engagement_level IN ('cold','warm','hot')),
    preferred_tone VARCHAR(50) DEFAULT 'inspiring',
    preferred_memory_type VARCHAR(100) DEFAULT 'The Quiet Moment',
    psychological_triggers TEXT,       -- JSON array stored as text
    travel_style VARCHAR(50) DEFAULT 'adventure',
    interaction_count INTEGER DEFAULT 0,
    last_interaction TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_person_profiles_email ON person_profiles(email);

-- ── COMPETITOR CONTENT ────────────────────────────────────────
-- Scraped competitor content for competitive intelligence
-- Used by: competitor-intelligence.service.ts (saveCompetitorContent, getCompetitiveLandscape)
CREATE TABLE IF NOT EXISTS competitor_content (
    id SERIAL PRIMARY KEY,
    competitor VARCHAR(255) NOT NULL,  -- competitor name (not handle)
    platform VARCHAR(50) DEFAULT 'instagram',
    post_type VARCHAR(50),             -- photo, reel, story, ad, email
    headline TEXT,
    body TEXT,
    cta TEXT,                          -- call to action
    psychological_tactic VARCHAR(100), -- scarcity, social_proof, FOMO, etc.
    engagement_estimate VARCHAR(20),   -- high, medium, low
    captured_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_competitor_content_tactic ON competitor_content(psychological_tactic);
CREATE INDEX idx_competitor_content_captured ON competitor_content(captured_at DESC);

-- ── FIX: approval_queue CHECK constraint ────────────────────────
-- memory-storytelling.service.ts inserts item_type='memory_story' which isn't in the original CHECK
-- Drop and recreate with 'memory_story' added
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approval_queue_item_type_check') THEN
    ALTER TABLE approval_queue DROP CONSTRAINT approval_queue_item_type_check;
    ALTER TABLE approval_queue ADD CONSTRAINT approval_queue_item_type_check
      CHECK (item_type IN ('outreach_email','partnership_email','content','proposal','report','memory_story'));
  END IF;
END $$;
