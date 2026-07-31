# TASK: Build Tier 1 Revenue Impact Agents

## Context
Safari Zetu is a safari marketplace platform. We have 14 AI agents built, 70 skills installed, and need to scale the business with more automations. The user wants agents that generate revenue and scale the SaaS.

## Scope — 5 New Agents (Tier 1: Revenue Impact)

### Agent 1: Sales Prospecting Engine
- **Division**: Growth
- **Skills Used**: Clay (prospecting), Apollo.io (enrichment), Browser-Use (scraping)
- **What It Does**:
  - Scrape travel directories for tour operators, travel agencies, corporate planners
  - Enrich leads with contact info, company size, social profiles
  - Score leads based on fit (safari relevance, budget, location)
  - Generate personalized outreach emails
- **Trigger**: Runs daily at 6AM
- **Output**: Qualified lead CSV + outreach emails sent via Resend
- **Files**: `src/agents/sales-prospector.ts`

### Agent 2: Dynamic Pricing Agent
- **Division**: Operations
- **Skills Used**: PandasAI (analytics), GPT-Researcher (market research), Browser-Use (competitor monitoring)
- **What It Does**:
  - Monitor competitor safari prices daily
  - Analyze demand signals (search volume, booking pace, seasonality)
  - Generate pricing recommendations per safari type
  - Alert operators of price adjustment opportunities
- **Trigger**: Runs daily at 7AM
- **Output**: Pricing report + operator alerts
- **Files**: `src/agents/dynamic-pricing.ts`

### Agent 3: Conversational Booking Bot
- **Division**: Customer Success
- **Skills Used**: Rasa (NLU), OpenClaw (multi-platform), Mem0 (memory), LangChain (chains)
- **What It Does**:
  - Handle booking inquiries via WhatsApp/Telegram
  - Understand intent: browse, book, modify, cancel
  - Access safari catalog via Chroma vector search
  - Remember traveler preferences via Mem0
  - Confirm bookings and send confirmations
- **Trigger**: Real-time webhook from WhatsApp/Telegram
- **Output**: Confirmed bookings + conversation logs
- **Files**: `src/agents/booking-bot.ts`, `src/agents/intents.yml`

### Agent 4: Revenue Analytics Dashboard
- **Division**: Analytics
- **Skills Used**: PandasAI (NL queries), Langfuse (tracing), Dify (visual builder)
- **What It Does**:
  - Accept natural language queries: "show me bookings by safari type"
  - Generate charts and reports automatically
  - Track revenue metrics: MRR, ARPU, churn, LTV
  - Send weekly revenue summary to founder
- **Trigger**: On-demand + weekly Monday 9AM
- **Output**: Interactive dashboard + weekly email report
- **Files**: `src/agents/revenue-analytics.ts`

### Agent 5: Automated Contract Generator
- **Division**: Partnerships
- **Skills Used**: CrewAI (multi-agent), Aider (code), Metagpt (docs)
- **What It Does**:
  - Generate partnership agreements from templates
  - Customize terms based on partner type (airline, lodge, activity)
  - Include commission structures, payment terms, liability clauses
  - Output PDF ready for e-signature
- **Trigger**: When new partner added to pipeline
- **Output**: PDF contract + email to partner
- **Files**: `src/agents/contract-generator.ts`

## Technical Requirements
- All agents use OpenCode Zen free models (same pattern as existing 14 agents)
- All agents follow existing code patterns (callAgent, prompts, triggers)
- Database tables for new data (leads, pricing, conversations, revenue, contracts)
- Cron jobs for scheduled agents
- Webhook receivers for real-time agents
- Dashboard panels for monitoring

## Verification
- Run `npx ts-node src/test-start.ts` after each agent
- Each agent must complete without errors on free models
- Token usage must stay under 2000 per call
- Total system cost must remain $0.00
