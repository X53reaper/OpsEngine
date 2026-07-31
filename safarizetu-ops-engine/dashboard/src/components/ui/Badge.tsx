import React from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  pulse?: boolean
  dot?: boolean
}

const variantStyles: Record<Variant, { bg: string; color: string; border: string }> = {
  default: { bg: 'var(--bg-muted)', color: 'var(--fg-secondary)', border: 'var(--border)' },
  success: { bg: 'var(--accent-dim)', color: 'var(--accent)', border: 'var(--accent-dim)' },
  warning: { bg: 'var(--gold-dim)', color: 'var(--gold)', border: 'var(--gold-dim)' },
  danger: { bg: 'var(--danger-dim)', color: 'var(--danger)', border: 'var(--danger-dim)' },
  info: { bg: 'var(--info-dim)', color: 'var(--info)', border: 'var(--info-dim)' },
  accent: { bg: 'var(--accent-glow)', color: 'var(--accent)', border: 'var(--accent)' },
}

export function Badge({ children, variant = 'default', pulse = false, dot = false }: BadgeProps) {
  const s = variantStyles[variant]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 10px',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      letterSpacing: '0.03em',
      borderRadius: '9999px',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: s.color,
          animation: pulse ? 'pulse 2s ease-in-out infinite' : undefined,
        }} />
      )}
      {children}
    </span>
  )
}

export function StatusDot({ status }: { status: 'healthy' | 'unhealthy' | 'starting' | 'unknown' }) {
  const colors = {
    healthy: 'var(--accent)',
    unhealthy: 'var(--danger)',
    starting: 'var(--gold)',
    unknown: 'var(--fg-muted)',
  }
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: colors[status],
      boxShadow: `0 0 6px ${colors[status]}`,
    }} />
  )
}
