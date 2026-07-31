import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  delta?: number
  icon?: React.ReactNode
  color?: string
  suffix?: string
}

export function MetricCard({ label, value, delta, icon, color, suffix }: MetricCardProps) {
  const deltaColor = delta !== undefined
    ? delta > 0 ? 'var(--accent)' : delta < 0 ? 'var(--danger)' : 'var(--fg-muted)'
    : undefined

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-5) var(--space-6)',
      minWidth: 200,
      flex: '1 1 200px',
      transition: 'all var(--transition-base)',
      animation: 'fadeIn 0.3s ease forwards',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-3)',
      }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase' as const,
          color: 'var(--fg-muted)',
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: color || 'var(--fg-muted)', opacity: 0.7 }}>
            {icon}
          </span>
        )}
      </div>

      <div style={{
        fontSize: 'var(--text-2xl)',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        color: color || 'var(--fg-primary)',
        lineHeight: 1,
        letterSpacing: '-0.02em',
      }}>
        {value}{suffix && <span style={{ fontSize: 'var(--text-sm)', fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 4 }}>{suffix}</span>}
      </div>

      {delta !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-xs)',
          color: deltaColor,
          fontWeight: 500,
        }}>
          {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          {delta > 0 ? '+' : ''}{delta}%
        </div>
      )}
    </div>
  )
}
