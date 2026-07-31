-- TIER 4: Growth & Expansion Schema
-- Market Research, Influencer Management, Localization, Sustainability

-- ── MARKET EXPANSION ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS market_research (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_name TEXT NOT NULL,
  region TEXT,
  market_size NUMERIC(12,2),
  growth_rate NUMERIC(5,2),
  competition_level TEXT CHECK (competition_level IN ('low', 'medium', 'high', 'very_high')),
  entry_barrier TEXT CHECK (entry_barrier IN ('low', 'medium', 'high')),
  opportunity_score NUMERIC(5,2),
  key_insights JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  research_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,
  market TEXT,
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  pricing_model TEXT,
  market_share NUMERIC(5,2),
  threat_level TEXT CHECK (threat_level IN ('low', 'medium', 'high')),
  last_analyzed DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INFLUENCER MANAGEMENT ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  handle TEXT,
  platform TEXT CHECK (platform IN ('instagram', 'youtube', 'tiktok', 'twitter', 'blog', 'podcast')),
  followers INTEGER,
  engagement_rate NUMERIC(5,4),
  niche TEXT,
  location TEXT,
  content_style TEXT,
  collaboration_rate NUMERIC(10,2),
  status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'contacted', 'negotiating', 'active', 'paused', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS influencer_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID REFERENCES influencers(id),
  campaign_name TEXT NOT NULL,
  campaign_type TEXT CHECK (campaign_type IN ('sponsored_post', 'story', 'reel', 'video', 'blog_post', 'takeover', 'giveaway')),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(10,2),
  deliverables JSONB DEFAULT '[]',
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  performance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── LOCALIZATION ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  context TEXT,
  translated_by TEXT DEFAULT 'ai',
  quality_score NUMERIC(3,2),
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS language_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL,
  language_name TEXT NOT NULL,
  completion_pct NUMERIC(5,2) DEFAULT 0,
  pages_translated INTEGER DEFAULT 0,
  total_pages INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'review', 'published'))
);

-- ── SUSTAINABILITY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT CHECK (metric_type IN ('carbon_footprint', 'water_usage', 'waste_generated', 'energy_consumption', 'wildlife_impact', 'community_benefit', 'jobs_created', 'conservation_funding')),
  value NUMERIC(12,2),
  unit TEXT,
  period DATE,
  source TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sustainability_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name TEXT NOT NULL,
  target_value NUMERIC(12,2),
  current_value NUMERIC(12,2) DEFAULT 0,
  unit TEXT,
  deadline DATE,
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'behind', 'achieved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sustainability_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_year INTEGER NOT NULL,
  report_type TEXT CHECK (report_type IN ('annual', 'quarterly', 'monthly')),
  esg_score NUMERIC(5,2),
  environmental_score NUMERIC(5,2),
  social_score NUMERIC(5,2),
  governance_score NUMERIC(5,2),
  highlights JSONB DEFAULT '[]',
  challenges JSONB DEFAULT '[]',
  goals_progress JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_market_region ON market_research(region);
CREATE INDEX IF NOT EXISTS idx_market_opportunity ON market_research(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_market ON competitor_analysis(market);
CREATE INDEX IF NOT EXISTS idx_influencers_platform ON influencers(platform);
CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status);
CREATE INDEX IF NOT EXISTS idx_influencers_niche ON influencers(niche);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON influencer_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language);
CREATE INDEX IF NOT EXISTS idx_sustainability_type ON sustainability_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_sustainability_period ON sustainability_metrics(period);
