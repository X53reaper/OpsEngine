import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  glow?: 'green' | 'gold' | 'red' | 'blue' | 'none'
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
}

const glowMap = {
  green: 'var(--shadow-glow-green)',
  gold: 'var(--shadow-glow-gold)',
  red: '0 0 20px rgba(239, 68, 68, 0.12)',
  blue: '0 0 20px rgba(59, 130, 246, 0.12)',
  none: 'none',
}

const padMap = {
  sm: 'var(--space-4)',
  md: 'var(--space-6)',
  lg: 'var(--space-8)',
}

export function Card({ children, className = '', glow = 'none', padding = 'md', hover = false }: CardProps) {
  return (
    <div
      className={`card ${className}`}
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: padMap[padding],
        boxShadow: glowMap[glow],
        transition: 'all var(--transition-base)',
        cursor: hover ? 'pointer' : 'default',
        animation: 'fadeIn 0.3s ease forwards',
      }}
      onMouseEnter={hover ? (e) => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      } : undefined}
      onMouseLeave={hover ? (e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      } : undefined}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-5)',
      }}
    >
      {children}
    </div>
  )
}

export function CardTitle({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <h3 style={{
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase' as const,
      color: 'var(--fg-secondary)',
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    }}>
      {children}
    </h3>
  )
}
