export interface Metrics {
  enquiries_this_week: number
  enquiry_delta: number
  response_rate: number
  operators_activated: number
  total_leads: number
  active_partnerships: number
  pending_approvals: number
  total_traces: number
  total_cost_usd: number
  total_tokens: number
  avg_latency_ms: number
  error_rate: number
  cost_by_model: Record<string, number>
  traces_by_status: Record<string, number>
  langfuse_connected: boolean
}

export interface ApprovalItem {
  id: string
  title: string
  item_type: string
  preview: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  created_at: string
  status: string
}

export interface PipelineItem {
  id: string
  company_name?: string
  contact_name?: string
  operator_name?: string
  status: string
  created_at?: string
  value?: number
}

export interface AgentCost {
  agent_name: string
  runs: number
  cost: number
}

export interface AgentCostData {
  total_cost_usd: number
  total_runs: number
  avg_cost: number
  by_agent: AgentCost[]
}

export interface LangfuseTrace {
  id: string
  name: string
  latency: number
  totalCost: number
  timestamp: string
  observations: string[]
}

export interface ContainerStatus {
  name: string
  status: string
  health?: string
}

export interface N8NWorkflow {
  id: string
  name: string
  active: boolean
}

export interface Skill {
  name: string
  category: string
  size: number
}
