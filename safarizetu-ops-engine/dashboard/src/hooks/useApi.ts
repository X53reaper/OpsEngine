import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import type { Metrics, ApprovalItem, AgentCostData, PipelineItem, LangfuseTrace, Skill } from '../types'

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000'

async function fetcher<T>(path: string): Promise<T> {
  const { data } = await axios.get(`${API}${path}`)
  return data
}

async function poster(path: string, body?: any) {
  const { data } = await axios.post(`${API}${path}`, body)
  return data
}

// ── Metrics ──
export function useMetrics() {
  return useQuery({
    queryKey: ['metrics'],
    queryFn: () => fetcher<any>('/metrics'),
    refetchInterval: 15000,
    staleTime: 10000,
  })
}

// ── Health ──
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetcher<any>('/health'),
    refetchInterval: 10000,
  })
}

// ── Approval Queue ──
export function useApprovalQueue() {
  const qc = useQueryClient()
  const approve = useMutation({
    mutationFn: (id: string) => poster(`/api/content/approve/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-queue'] }),
  })
  const reject = useMutation({
    mutationFn: (id: string) => poster(`/api/content/reject/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-queue'] }),
  })
  const approveAll = useMutation({
    mutationFn: () => poster('/api/content/approve-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-queue'] }),
  })
  return {
    ...useQuery({
      queryKey: ['approval-queue'],
      queryFn: () => fetcher<{ items: ApprovalItem[] }>('/api/content/pending'),
      refetchInterval: 30000,
    }),
    approve, reject, approveAll,
  }
}

// ── Agent Costs ──
export function useAgentCosts() {
  return useQuery({
    queryKey: ['agent-costs'],
    queryFn: () => fetcher<AgentCostData>('/metrics'),
    refetchInterval: 30000,
  })
}

// ── Pipeline ──
export function usePartnerships() {
  return useQuery({
    queryKey: ['partnerships'],
    queryFn: () => fetcher<{ items: PipelineItem[] }>('/api/competitors'),
    refetchInterval: 60000,
  })
}

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: () => fetcher<{ items: PipelineItem[] }>('/api/competitors/landscape'),
    refetchInterval: 60000,
  })
}

// ── Langfuse Traces ──
export function useLangfuseTraces() {
  return useQuery({
    queryKey: ['langfuse-traces'],
    queryFn: () => fetcher<{ data: LangfuseTrace[] }>('/api/skills'),
    refetchInterval: 30000,
  })
}

// ── Skills ──
export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => fetcher<{ skills: Skill[]; count: number }>('/api/skills'),
    refetchInterval: 60000,
  })
}

// ── N8N Workflows ──
export function useN8NWorkflows() {
  return useQuery({
    queryKey: ['n8n-workflows'],
    queryFn: () => fetcher<any>('/api/skills'),
    refetchInterval: 60000,
  })
}

// ── Research (on-demand) ──
export function useResearch() {
  return useMutation({
    mutationFn: (topic: string) => poster('/api/research', { topic }),
  })
}
