-- TIER 2: Operational Excellence Schema
-- Inventory, Sentiment, Social Content, Operator Scoring, Onboarding

-- ── INVENTORY MANAGEMENT ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT CHECK (item_type IN ('lodge', 'vehicle', 'equipment', 'guide', 'activity')),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  capacity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'booked', 'maintenance', 'retired')),
  daily_rate NUMERIC(10,2),
  operating_cost NUMERIC(10,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  date DATE NOT NULL,
  available_count INTEGER DEFAULT 1,
  booked_count INTEGER DEFAULT 0,
  blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id),
  alert_type TEXT CHECK (alert_type IN ('shortage', 'overbooking', 'maintenance_due', 'low_stock', 'price_change')),
  message TEXT,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SENTIMENT TRACKING ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT CHECK (platform IN ('tripadvisor', 'google', 'booking', 'airbnb', 'direct', 'other')),
  reviewer_name TEXT,
  rating NUMERIC(3,1),
  title TEXT,
  content TEXT,
  sentiment_score NUMERIC(5,4),
  sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  topics JSONB DEFAULT '[]',
  response_required BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  entity_name TEXT,
  entity_type TEXT CHECK (entity_type IN ('lodge', 'park', 'operator', 'activity', 'platform')),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentiment_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT,
  entity_type TEXT,
  period DATE,
  avg_rating NUMERIC(3,2),
  review_count INTEGER,
  positive_pct NUMERIC(5,2),
  negative_pct NUMERIC(5,2),
  neutral_pct NUMERIC(5,2),
  top_positive_topics JSONB DEFAULT '[]',
  top_negative_topics JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SOCIAL MEDIA CONTENT ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'twitter', 'tiktok', 'linkedin', 'youtube')),
  content_type TEXT CHECK (content_type IN ('image', 'video', 'carousel', 'story', 'reel', 'text', 'link')),
  caption TEXT,
  hashtags TEXT[],
  media_url TEXT,
  media_type TEXT,
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'archived')),
  engagement JSONB DEFAULT '{}',
  topic TEXT,
  safari_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  total_posts INTEGER DEFAULT 0,
  posts_by_platform JSONB DEFAULT '{}',
  content_themes JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── OPERATOR SCORING ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operator_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID,
  operator_name TEXT,
  period DATE,
  response_time_score NUMERIC(5,2),
  booking_conversion_score NUMERIC(5,2),
  review_rating_score NUMERIC(5,2),
  completeness_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  tier TEXT CHECK (tier IN ('platinum', 'gold', 'silver', 'bronze')),
  recommendations JSONB DEFAULT '[]',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operator_improvements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID,
  category TEXT,
  current_value TEXT,
  target_value TEXT,
  improvement_text TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ONBOARDING FLOW ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_type TEXT CHECK (user_type IN ('tourist', 'operator')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 5,
  steps_completed JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  nudge_sent BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT CHECK (user_type IN ('tourist', 'operator')),
  step_number INTEGER,
  step_name TEXT,
  step_description TEXT,
  required BOOLEAN DEFAULT TRUE,
  estimated_time_minutes INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_type ON inventory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_availability_date ON inventory_availability(date);
CREATE INDEX IF NOT EXISTS idx_availability_item ON inventory_availability(item_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reviews_sentiment ON reviews(sentiment_label);
CREATE INDEX IF NOT EXISTS idx_reviews_entity ON reviews(entity_name);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_platform ON content_queue(platform);
CREATE INDEX IF NOT EXISTS idx_content_scheduled ON content_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scores_operator ON operator_scores(operator_id);
CREATE INDEX IF NOT EXISTS idx_scores_tier ON operator_scores(tier);
CREATE INDEX IF NOT EXISTS idx_onboarding_user ON onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_type ON onboarding_progress(user_type);
