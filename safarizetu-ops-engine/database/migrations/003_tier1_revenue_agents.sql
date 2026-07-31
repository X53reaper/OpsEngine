-- TIER 1: Revenue Impact Schema
-- Sales Prospecting, Dynamic Pricing, Booking Bot, Revenue Analytics, Contracts

-- ── SALES PROSPECTING ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  company_type TEXT CHECK (company_type IN ('tour_operator', 'travel_agency', 'corporate', 'wedding_planner', 'influencer', 'other')),
  location TEXT,
  employee_count INTEGER,
  estimated_revenue NUMERIC(12,2),
  lead_score INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  lead_status TEXT DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  source TEXT,
  notes TEXT,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  channel TEXT CHECK (channel IN ('email', 'linkedin', 'whatsapp', 'phone', 'other')),
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'replied', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DYNAMIC PRICING ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safari_type TEXT NOT NULL,
  competitor_name TEXT,
  competitor_price NUMERIC(10,2),
  our_price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  demand_index NUMERIC(5,2),
  season TEXT CHECK (season IN ('peak', 'shoulder', 'low')),
  occupancy_rate NUMERIC(5,2),
  recommended_price NUMERIC(10,2),
  price_change_pct NUMERIC(5,2),
  reasoning TEXT,
  data_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safari_type TEXT NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('price_drop', 'price_increase', 'demand_spike', 'demand_drop', 'competitor_change')),
  message TEXT,
  recommended_action TEXT,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── BOOKING BOT ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tourist_id UUID,
  platform TEXT CHECK (platform IN ('whatsapp', 'telegram', 'web', 'sms')),
  platform_user_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'transferred')),
  intent TEXT,
  sentiment NUMERIC(3,2),
  messages_count INTEGER DEFAULT 0,
  booking_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  role TEXT CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent_detected TEXT,
  entities JSONB DEFAULT '{}',
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REVENUE ANALYTICS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revenue_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(12,2),
  metric_unit TEXT,
  dimension_1 TEXT,
  dimension_2 TEXT,
  period TEXT,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'custom')),
  period_start DATE,
  period_end DATE,
  total_revenue NUMERIC(12,2),
  total_bookings INTEGER,
  avg_booking_value NUMERIC(10,2),
  new_customers INTEGER,
  returning_customers INTEGER,
  churn_rate NUMERIC(5,2),
  mrr NUMERIC(12,2),
  arpu NUMERIC(10,2),
  ltv NUMERIC(10,2),
  report_data JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CONTRACTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID,
  partner_name TEXT NOT NULL,
  contract_type TEXT CHECK (contract_type IN ('airline', 'lodge', 'activity', 'transport', 'insurance', 'technology', 'other')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'sent', 'signed', 'expired', 'terminated')),
  commission_pct NUMERIC(5,2),
  commission_type TEXT DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed', 'tiered')),
  payment_terms TEXT,
  start_date DATE,
  end_date DATE,
  terms JSONB DEFAULT '{}',
  pdf_url TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_pricing_date ON pricing_data(data_date);
CREATE INDEX IF NOT EXISTS idx_pricing_type ON pricing_data(safari_type);
CREATE INDEX IF NOT EXISTS idx_conversations_platform ON conversations(platform);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_revenue_period ON revenue_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_partner ON contracts(partner_id);
