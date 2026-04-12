import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line
} from 'recharts'

const API = 'http://127.0.0.1:8000'
const COLORS = ['#4f8ef7', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#38bdf8']
const TT_STYLE = {
  background: '#16162a', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, fontSize: 12, color: '#e8e8f0', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: '4px 14px 14px 14px', border: '1px solid var(--border)', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  )
}

// ─── Anomaly Dot ──────────────────────────────────────────────────────────────
function AnomalyDot({ cx, cy, payload }) {
  if (!payload?.isAnomaly) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#f87171" stroke="#ff4444" strokeWidth={2} opacity={0.9} />
      <circle cx={cx} cy={cy} r={11} fill="none" stroke="#f87171" strokeWidth={1} opacity={0.35} />
    </g>
  )
}

// ─── Metric Card (improved) ───────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon }) {
  const colors = { blue: '#4f8ef7', green: '#34d399', orange: '#fb923c', red: '#f87171', purple: '#a78bfa' }
  const c = colors[accent] || colors.blue
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 18px', position: 'relative', overflow: 'hidden',
      transition: 'border-color 0.2s', cursor: 'default'
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* left accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: c, borderRadius: '3px 0 0 3px' }} />
      {/* subtle glow */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(ellipse at 0% 50%, ${c}10 0%, transparent 60%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 20, opacity: 0.6 }}>{icon}</div>}
      </div>
    </div>
  )
}

// ─── Confidence Bar (compact, inline) ─────────────────────────────────────────
function ConfidenceBar({ confidence, dashData }) {
  const [showTip, setShowTip] = useState(false)
  if (!confidence) return null
  const { score, label } = confidence

  const color = score >= 75 ? '#34d399' : score >= 50 ? '#fb923c' : '#f87171'

  // Reconstruct the three sub-scores from the same logic as backend compute_confidence
  const n = dashData?.historical?.length || 0
  const lengthScore = Math.min(40, (n / 52) * 40)

  const vals = dashData?.historical?.map(h => h.value) || []
  let volatilityScore = 0
  if (vals.length > 0) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length
    const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
    const cv = mean !== 0 ? std / Math.abs(mean) : 1
    volatilityScore = Math.max(0, 40 * (1 - Math.min(cv, 1)))
  }
  const seasonalityScore = dashData?.seasonality_period ? 20 : 0

  const breakdown = [
    { label: 'Data length', score: Math.round(lengthScore), max: 40, tip: `${n} data points — more rows = higher score (max at 52+)` },
    { label: 'Low volatility', score: Math.round(volatilityScore), max: 40, tip: 'Based on coefficient of variation (std ÷ mean) of your data' },
    { label: 'Seasonality', score: seasonalityScore, max: 20, tip: dashData?.seasonality_period ? `Weekly pattern detected (period = ${dashData.seasonality_period})` : 'No repeating seasonal pattern found' },
  ]

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Forecast Confidence</div>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap', minWidth: 90 }}>{score}/100 · {label}</div>

      {/* ⓘ button */}
      <div style={{ position: 'relative', flexShrink: 0 }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <div style={{
          width: 16, height: 16, borderRadius: '50%', border: `1px solid ${color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color, cursor: 'default',
          opacity: showTip ? 1 : 0.55, transition: 'opacity 0.15s'
        }}>i</div>

        {showTip && (
          <div style={{
            position: 'absolute', right: 0, bottom: 24, width: 260,
            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '14px 16px', zIndex: 100,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.15s ease'
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '0.3px' }}>
              How confidence is calculated
            </div>
            {breakdown.map(({ label, score: s, max, tip }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s >= max * 0.7 ? '#34d399' : s >= max * 0.4 ? '#fb923c' : '#f87171' }}>
                    {s} / {max}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${(s / max) * 100}%`, background: s >= max * 0.7 ? '#34d399' : s >= max * 0.4 ? '#fb923c' : '#f87171', borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{tip}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Total score</span>
              <span style={{ fontSize: 11, fontWeight: 700, color }}>{score}/100 · {label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Full CSV Viewer ──────────────────────────────────────────────────────────
function CsvViewer({ allRows, rowCount }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  if (!allRows?.length) return null
  const cols = Object.keys(allRows[0])

  const filtered = searchTerm
    ? allRows.filter(row => cols.some(c => String(row[c] ?? '').toLowerCase().includes(searchTerm.toLowerCase())))
    : allRows

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleSearch = (val) => { setSearchTerm(val); setCurrentPage(1) }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 CSV Data</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{rowCount} rows · {cols.length} cols</span>
          {searchTerm && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(79,142,247,0.12)', color: 'var(--accent-light)', border: '1px solid rgba(79,142,247,0.2)' }}>{filtered.length} match</span>}
        </div>
        {/* Search */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '4px 10px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>🔍</span>
          <input
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search..."
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 11, color: 'var(--text-primary)', width: 120 }}
          />
          {searchTerm && <button onClick={() => handleSearch('')} style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 340 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: '#0f0f1e' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', minWidth: 36 }}>#</th>
              {cols.map(c => (
                <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              const globalIdx = (currentPage - 1) * PAGE_SIZE + i + 1
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '7px 10px', color: 'var(--text-tertiary)', fontSize: 10, userSelect: 'none' }}>{globalIdx}</td>
                  {cols.map(c => (
                    <td key={c} style={{ padding: '7px 12px', color: typeof row[c] === 'number' ? '#93bbff' : 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typeof row[c] === 'number' ? row[c]?.toLocaleString() : String(row[c] ?? '')}
                    </td>
                  ))}
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No rows match your search</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Rows {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 11 }}>«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 11 }}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
              const pg = start + i
              return pg <= totalPages ? (
                <button key={pg} onClick={() => setCurrentPage(pg)} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${currentPage === pg ? 'var(--accent)' : 'var(--border)'}`, background: currentPage === pg ? 'var(--accent-bg)' : 'var(--bg-secondary)', color: currentPage === pg ? 'var(--accent-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: currentPage === pg ? 700 : 400 }}>{pg}</button>
              ) : null
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 11 }}>›</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 11 }}>»</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard Forecast Chart ─────────────────────────────────────────────────
function DashForecastChart({ historical, forecast, anomalies }) {
  if (!historical?.length) return null
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = [
    ...historical.slice(-20).map((h, i) => {
      const globalIdx = historical.length - Math.min(20, historical.length) + i
      return { date: h.date?.slice(5), actual: h.value, isAnomaly: anomalyIndices.has(globalIdx) }
    }),
    ...(forecast || []).map(f => ({ date: f.date_label || `W+${f.period}`, likely: f.likely, low: f.low, high: f.high }))
  ]
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ ...TT_STYLE, padding: '8px 12px' }}>
        <div style={{ marginBottom: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>{label}</div>
        {payload.map((p, i) => p.value != null && <div key={i} style={{ color: p.color, fontSize: 12 }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>)}
        {payload[0]?.payload?.isAnomaly && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠ Anomaly detected</div>}
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="dA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.25} /><stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.18} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} tickFormatter={v => v ? v.toLocaleString() : ''} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="actual" stroke="#4f8ef7" strokeWidth={2} fill="url(#dA)" connectNulls name="Historical" dot={<AnomalyDot />} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="likely" stroke="#34d399" strokeWidth={2} strokeDasharray="5 3" fill="url(#dF)" dot={{ r: 3, fill: '#34d399' }} connectNulls name="Forecast" />
        <Area type="monotone" dataKey="high" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Upper" />
        <Area type="monotone" dataKey="low" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Lower" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Anomaly List (dashboard) ─────────────────────────────────────────────────
function AnomalyList({ anomalies }) {
  if (!anomalies) return null
  if (anomalies.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>
      ✓ No anomalies detected — data looks clean
    </div>
  )
  const severe = anomalies.filter(a => a.severity === 'severe').length
  const moderate = anomalies.filter(a => a.severity === 'moderate').length
  const mild = anomalies.filter(a => a.severity === 'mild').length
  return (
    <div>
      {/* summary pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {severe > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 600 }}>{severe} Severe</span>}
        {moderate > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)', fontWeight: 600 }}>{moderate} Moderate</span>}
        {mild > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', fontWeight: 600 }}>{mild} Mild</span>}
      </div>
      {anomalies.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>
              {a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · {a.date || `Point ${a.index}`}
            </div>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>{a.severity}</span>
          </div>
          <div style={{ fontSize: 12, color: '#fca5a5' }}>
            Value <strong>{a.value?.toLocaleString()}</strong> · {Math.abs(a.pct_from_mean)}% from mean · Z = {a.z_score}
          </div>
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 5, padding: '4px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>{a.next_step}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Category Rankings ────────────────────────────────────────────────────────
function CategoryRankings({ rankings }) {
  if (!rankings?.length) return null
  const max = rankings[0]?.forecasted_weekly_avg || 1
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Category Rankings</div>
      {rankings.map((cat, i) => (
        <div key={cat.category} style={{ marginBottom: i < rankings.length - 1 ? 10 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              {i === 0 && <span style={{ fontSize: 12 }}>🏆</span>}
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 700 : 400 }}>{cat.category}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cat.growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{cat.growth_pct >= 0 ? '+' : ''}{cat.growth_pct}%</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cat.forecasted_weekly_avg?.toLocaleString()}/wk</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(cat.forecasted_weekly_avg / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, opacity: i === 0 ? 1 : 0.55 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Region Signals ───────────────────────────────────────────────────────────
function RegionSignals({ signals }) {
  if (!signals?.length) return null
  const signalConfig = {
    anomaly_surge: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', icon: '🚨' },
    anomaly_decline: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', icon: '📉' },
    anomaly: { color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', icon: '⚠️' },
    surge: { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', icon: '🚀' },
    decline: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', icon: '📉' },
    stable: { color: '#8888a8', bg: 'rgba(136,136,168,0.06)', border: 'rgba(136,136,168,0.15)', icon: '✓' },
  }
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Region Signals</div>
      {signals.map(r => {
        const regionName = r.region || r.value
        const cfg = signalConfig[r.signal] || signalConfig.stable
        return (
          <div key={regionName} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 9, marginBottom: 8 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{regionName}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, padding: '1px 7px', borderRadius: 10, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{r.signal_label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                Avg {(r.recent_avg_revenue || r.recent_avg)?.toLocaleString()} · {r.anomaly_count > 0 ? `${r.anomaly_count} anomal${r.anomaly_count > 1 ? 'ies' : 'y'}` : 'No anomalies'}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
              {r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Inline: Forecast Chart ───────────────────────────────────────────────────
function InlineForecastChart({ historical, forecast, anomalies, metric, filterLabel }) {
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = [
    ...historical.slice(-16).map((pt, i) => {
      const globalIdx = historical.length - Math.min(16, historical.length) + i
      return { date: pt.date?.slice(5), actual: pt.value, isAnomaly: anomalyIndices.has(globalIdx) }
    }),
    ...(forecast || []).map(f => ({ date: f.date_label || `W+${f.period}`, likely: f.likely, low: f.low, high: f.high }))
  ]
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 8px 8px', border: '1px solid var(--border)' }}>
      {filterLabel && <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, paddingLeft: 8 }}>Filtered: {filterLabel}</div>}
      <div style={{ display: 'flex', gap: 12, paddingLeft: 8, marginBottom: 8 }}>
        {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l}</span>
          </div>
        ))}
        {anomalies?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Anomaly</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={`gA-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.2} /><stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`gF-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} tickFormatter={v => v ? v.toLocaleString() : ''} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v?.toLocaleString(), n]} />
          <Area type="monotone" dataKey="actual" stroke="#4f8ef7" strokeWidth={2} fill={`url(#gA-${metric})`} connectNulls name="Historical" dot={<AnomalyDot />} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="likely" stroke="#34d399" strokeWidth={2} strokeDasharray="5 3" fill={`url(#gF-${metric})`} dot={{ r: 3, fill: '#34d399' }} connectNulls name="Forecast" />
          <Area type="monotone" dataKey="high" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Upper" />
          <Area type="monotone" dataKey="low" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Lower" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Inline: Anomaly Chart ────────────────────────────────────────────────────
function InlineAnomalyChart({ historical, anomalies, metric, filterLabel }) {
  if (!historical?.length) return null
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = historical.map((h, i) => ({
    date: h.date?.slice(5), value: h.value,
    isAnomaly: anomalyIndices.has(i),
    anomalyValue: anomalyIndices.has(i) ? h.value : null
  }))
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 8px 8px', border: '1px solid var(--border)' }}>
      {filterLabel && <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, paddingLeft: 8 }}>Filtered: {filterLabel}</div>}
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={chartData} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} tickFormatter={v => v ? v.toLocaleString() : ''} />
          <Tooltip contentStyle={TT_STYLE} formatter={(v, n) => [v?.toLocaleString(), n]} />
          <Line type="monotone" dataKey="value" stroke="#4f8ef7" strokeWidth={2} dot={false} connectNulls name={metric} />
          <Line type="monotone" dataKey="anomalyValue" stroke="#f87171" strokeWidth={0} name="Anomaly"
            dot={({ cx, cy, payload }) => {
              if (!payload.isAnomaly) return null
              return (
                <g key={`ad-${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={6} fill="#f87171" stroke="#ff4444" strokeWidth={2} opacity={0.9} />
                  <circle cx={cx} cy={cy} r={11} fill="none" stroke="#f87171" strokeWidth={1} opacity={0.35} />
                </g>
              )
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Inline: Rankings ─────────────────────────────────────────────────────────
function InlineRankingsChart({ rankings, dimension }) {
  if (!rankings?.length) return null
  const dimLabel = dimension === 'product_category' ? 'category' : 'region'
  const max = rankings[0]?.forecasted_weekly_avg || 1
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>By {dimLabel} — forecasted weekly avg</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🏆</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{rankings[0].value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {rankings[0].forecasted_weekly_avg?.toLocaleString()}/wk · <span style={{ color: rankings[0].growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{rankings[0].growth_pct >= 0 ? '+' : ''}{rankings[0].growth_pct}%</span>
          </div>
        </div>
      </div>
      {rankings.map((r, i) => (
        <div key={r.value} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>{r.value}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.forecasted_weekly_avg?.toLocaleString()}/wk</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(r.forecasted_weekly_avg / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, opacity: i === 0 ? 1 : 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Inline: Dimension Signals ────────────────────────────────────────────────
function InlineDimensionSignals({ signals, dimension }) {
  if (!signals?.length) return null
  const dimLabel = dimension === 'product_category' ? 'Category' : 'Region'
  const signalCfg = {
    anomaly_surge: { color: '#f87171', icon: '🚨' },
    anomaly_decline: { color: '#f87171', icon: '📉' },
    anomaly: { color: '#fb923c', icon: '⚠️' },
    surge: { color: '#34d399', icon: '🚀' },
    decline: { color: '#f87171', icon: '📉' },
    stable: { color: '#8888a8', icon: '✓' }
  }
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{dimLabel} signals</div>
      {signals.map((s) => {
        const cfg = signalCfg[s.signal] || signalCfg.stable
        return (
          <div key={s.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6, background: s.watch ? 'rgba(248,113,113,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px solid ${s.watch ? 'rgba(248,113,113,0.15)' : 'var(--border)'}` }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: s.watch ? 600 : 400, color: 'var(--text-primary)', marginBottom: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.signal_label} · {s.anomaly_count} anomalies · avg {s.recent_avg?.toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
              {s.growth_pct >= 0 ? '+' : ''}{s.growth_pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Inline: Scenario Table ───────────────────────────────────────────────────
function InlineScenarioTable({ comparison, adjustment, metric }) {
  if (!comparison?.length) return null
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {metric} scenario
        <span style={{ color: adjustment > 0 ? 'var(--green)' : adjustment < 0 ? 'var(--red)' : 'var(--text-tertiary)', fontWeight: 700 }}>
          {adjustment === 0 ? ' (flat)' : ` (${adjustment > 0 ? '+' : ''}${adjustment}%)`}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            {['Date', 'Baseline', 'Scenario', 'Δ Difference'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {comparison.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 10px', color: 'var(--text-tertiary)' }}>{row.date_label || `W${row.period}`}</td>
              <td style={{ padding: '7px 10px', color: 'var(--text-primary)' }}>{row.baseline?.toLocaleString()}</td>
              <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.scenario?.toLocaleString()}</td>
              <td style={{ padding: '7px 10px', fontWeight: 700, color: row.difference >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {row.difference >= 0 ? '+' : ''}{row.difference?.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Inline: Best vs Worst ────────────────────────────────────────────────────
function InlineBestWorstTable({ bestForecast, worstForecast, baselineForecast, metric }) {
  if (!bestForecast?.length || !worstForecast?.length) return null
  const bestTotal = bestForecast.reduce((s, f) => s + f.likely, 0)
  const worstTotal = worstForecast.reduce((s, f) => s + f.likely, 0)
  const baseTotal = baselineForecast?.reduce((s, f) => s + f.likely, 0) || 0
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {metric} — best (+20%) vs worst (-20%)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[['Best Case', bestTotal, 'var(--green)'], ['Baseline', baseTotal, 'var(--accent)'], ['Worst Case', worstTotal, 'var(--red)']].map(([label, value, color]) => (
          <div key={label} style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{value?.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            {['Date', 'Best', 'Base', 'Worst', 'Gap'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bestForecast.map((b, i) => {
            const w = worstForecast[i] || {}; const bl = baselineForecast?.[i] || {}
            return (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{b.date_label || `W${b.period}`}</td>
                <td style={{ padding: '6px 10px', color: 'var(--green)', fontWeight: 600 }}>{b.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{bl.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--red)', fontWeight: 600 }}>{w.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{(b.likely - (w.likely || 0))?.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}



// ─── Chat Message ─────────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '9px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 13, maxWidth: '82%', lineHeight: 1.6 }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
        </div>
      </div>
    )
  }
  const d = msg.data || {}
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '4px 14px 14px 14px', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border)', lineHeight: 1.75 }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
        </div>
        {d.filter_label && (
          <div style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: 'var(--accent)', padding: '2px 10px', background: 'var(--accent-bg)', borderRadius: 20, border: '1px solid rgba(79,142,247,0.2)' }}>
            Filtered: {d.filter_label}
          </div>
        )}
        {d.graph_type === 'forecast' && d.historical && d.forecast && (
          <InlineForecastChart historical={d.historical} forecast={d.forecast} anomalies={d.anomalies} metric={d.metric} filterLabel={d.filter_label} />
        )}
        {d.graph_type === 'rankings' && d.rankings && (
          <InlineRankingsChart rankings={d.rankings} dimension={d.dimension} />
        )}
        {d.graph_type === 'anomaly' && d.historical && (
          <>
            <InlineAnomalyChart historical={d.historical} anomalies={d.anomalies} metric={d.metric} filterLabel={d.filter_label} />
            {d.anomalies?.length === 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>✓ No anomalies — data looks clean</div>
            )}
            {d.anomalies?.map((a, i) => (
              <div key={i} style={{ marginTop: 6, padding: '9px 12px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 3 }}>
                  {a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · {a.date || `Point ${a.index}`}
                  <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.2)' }}>{a.severity?.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 12, color: '#fca5a5' }}>Value <strong>{a.value?.toLocaleString()}</strong> · {Math.abs(a.pct_from_mean)}% from mean · Z={a.z_score}</div>
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, padding: '4px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>{a.next_step}</div>
              </div>
            ))}
          </>
        )}
        {d.graph_type === 'dimension_signals' && d.signals && (
          <InlineDimensionSignals signals={d.signals} dimension={d.dimension} />
        )}
        {d.graph_type === 'scenario' && d.comparison && (
          <InlineScenarioTable comparison={d.comparison} adjustment={d.adjustment_pct} metric={d.metric} />
        )}
        {d.graph_type === 'best_worst' && d.best_forecast && (
          <InlineBestWorstTable bestForecast={d.best_forecast} worstForecast={d.worst_forecast} baselineForecast={d.baseline_forecast} metric={d.metric} />
        )}
        {d.graph_type === 'forecast' && d.confidence && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Confidence:</div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.confidence.score}%`, background: d.confidence.score >= 75 ? '#34d399' : d.confidence.score >= 50 ? '#fb923c' : '#f87171', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: d.confidence.score >= 75 ? 'var(--green)' : d.confidence.score >= 50 ? '#fb923c' : 'var(--red)' }}>{d.confidence.score}/100 {d.confidence.label}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ChatApp() {
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [mode, setMode] = useState(null)
  const [insightsData, setInsightsData] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [allCsvRows, setAllCsvRows] = useState(null)
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [mainColumn, setMainColumn] = useState('revenue')
  const [dataSchema, setDataSchema] = useState(null)
  const [periods, setPeriods] = useState(4)
  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState(null)
  const [liveChart, setLiveChart] = useState(null)
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'anomalies'

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: "Hi! I'm your forecasting assistant. Upload a CSV to get started — I support forecasting, anomaly detection, and scenario analysis across any metric, category, or region.",
    data: {}
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const fileRef = useRef()
  const bottomRef = useRef()

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  const handleFile = async (e) => {
    const f = e.target.files[0]; if (!f) return
    setFile(f); setFileName(f.name); setDashData(null); setInsightsData(null); setAllCsvRows(null)
    setMode(null); setLiveChart(null); setDataSchema(null); setActiveTab('overview')

    // Parse full CSV for the viewer
    try {
      const text = await f.text()
      const lines = text.trim().split('\n')
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, i) => {
          const num = parseFloat(vals[i])
          row[h] = vals[i] !== '' && !isNaN(num) ? num : (vals[i] ?? '')
        })
        return row
      })
      setAllCsvRows(rows)
    } catch {}

    setMessages(prev => [...prev, { role: 'bot', content: `📂 Loaded ${f.name}. Running analysis...`, data: {} }])
    setDashLoading(true); setDashError(null)
    try {
      const sf = new FormData(); sf.append('file', f)
      const sr = await axios.post(`${API}/schema`, sf)
      setDataSchema(sr.data.schema)
    } catch {}
    try {
      const form = new FormData(); form.append('file', f)
      try {
        const res = await axios.post(`${API}/insights?periods=${periods}`, form)
        setInsightsData(res.data); setMode('insights'); setMainColumn('revenue')
        setDataSchema(res.data.schema || dataSchema)
        setMessages(prev => [...prev, { role: 'bot', content: `✓ Multi-dimensional dataset — ${res.data.categories?.length || 0} categories, ${res.data.regions?.length || 0} regions. Dashboard ready!`, data: {} }])
      } catch {
        const f2 = new FormData(); f2.append('file', f)
        const res2 = await axios.post(`${API}/forecast?periods=${periods}`, f2)
        setDashData(res2.data); setSelectedColumn(res2.data.selected_column)
        setMainColumn(res2.data.selected_column || 'value'); setMode('forecast')
        setMessages(prev => [...prev, { role: 'bot', content: `✓ Columns: ${res2.data.numeric_columns?.join(', ')}. Forecasting "${res2.data.selected_column}".`, data: {} }])
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to read file.'
      setDashError(msg); setMessages(prev => [...prev, { role: 'bot', content: `❌ ${msg}`, data: {} }])
    }
    setDashLoading(false)
  }

  const runForecast = async (col, f = file, p = periods) => {
    if (!f) return; setDashLoading(true); setDashError(null)
    try {
      const form = new FormData(); form.append('file', f)
      const res = await axios.post(`${API}/forecast?periods=${p}&column=${col}`, form)
      setDashData(res.data); setSelectedColumn(res.data.selected_column)
    } catch (e) { setDashError(e.response?.data?.detail || 'Forecast failed.') }
    setDashLoading(false)
  }

  const sendMessage = async (text) => {
    const msg = text || input.trim(); if (!msg) return
    if (!file) {
      setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'bot', content: 'Please upload a CSV file first!', data: {} }])
      setInput(''); return
    }
    setMessages(prev => [...prev, { role: 'user', content: msg }]); setInput(''); setChatLoading(true)
    try {
      const form = new FormData(); form.append('file', file); form.append('question', msg)
      const col = mode === 'insights' ? mainColumn : (selectedColumn || mainColumn || 'revenue')
      const res = await axios.post(`${API}/chat?column=${col}`, form)
      const d = res.data
      if (d.graph_type === 'forecast' && d.historical && d.forecast) {
        setLiveChart({ historical: d.historical, forecast: d.forecast, anomalies: d.anomalies || [], metric: d.metric })
      } else if (d.graph_type === 'anomaly' && d.historical) {
        setLiveChart({ historical: d.historical, forecast: [], anomalies: d.anomalies || [], metric: d.metric })
      }
      setMessages(prev => [...prev, {
        role: 'bot', content: d.ai_summary || 'Done — see the chart below.',
        data: {
          graph_type: d.graph_type, metric: d.metric, filter_label: d.filter_label,
          forecast: d.forecast, historical: d.historical, anomalies: d.anomalies, confidence: d.confidence,
          rankings: d.rankings, dimension: d.dimension, signals: d.signals,
          comparison: d.comparison, adjustment_pct: d.adjustment_pct,
          best_forecast: d.best_forecast, worst_forecast: d.worst_forecast, baseline_forecast: d.baseline_forecast,
        }
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: 'Something went wrong. Make sure the backend is running.', data: {} }])
    }
    setChatLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const suggestions = mode === 'insights'
    ? [`What will ${mainColumn} look like next 4 weeks?`, 'Which category performs best?', 'Which region has the most unusual activity?', 'Any sudden spikes in revenue?', `What if ${mainColumn} grows by 10%?`, 'Show best case vs worst case']
    : selectedColumn
      ? [`Forecast ${selectedColumn} next 4 weeks`, `Any anomalies in ${selectedColumn}?`, `What if ${selectedColumn} grows by 20%?`, 'Show best case vs worst case']
      : ['Forecast next 4 weeks', 'Any anomalies?', 'What if sales grow by 20%?']

  // Derived values
  const id = insightsData
  const lastRevActual = id?.revenue_historical?.[id.revenue_historical.length - 1]?.value
  const firstRevForecast = id?.revenue_forecast?.[0]?.likely
  const overallRevGrowth = id?.revenue_forecast?.[id.revenue_forecast.length - 1]?.growth_pct
  const watchRegion = id?.region_signals?.find(r => r.watch)
  const bestCat = id?.category_rankings?.[0]
  const lastActual = dashData?.historical?.[dashData.historical.length - 1]?.value
  const firstForecast = dashData?.forecast?.[0]?.likely
  const overallGrowth = dashData?.forecast?.[dashData.forecast.length - 1]?.growth_pct
  const avgLast4 = dashData?.historical?.slice(-4).reduce((s, h) => s + h.value, 0) / 4 || 0

  // Anomaly severity breakdown
  const anomalies = dashData?.anomalies || id?.revenue_anomalies || []
  const severeCount = anomalies.filter(a => a.severity === 'severe').length
  const anomalySubtext = anomalies.length === 0 ? 'None detected'
    : severeCount > 0 ? `${severeCount} severe · ${anomalies.length - severeCount} other`
    : `${anomalies.length} flagged`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg-root: #080810; --bg-primary: #0b0b18; --bg-secondary: #0f0f1e;
          --bg-card: #13131f; --bg-hover: #1a1a2c;
          --border: rgba(255,255,255,0.07); --border-hover: rgba(255,255,255,0.13);
          --text-primary: #eaeaf4; --text-secondary: #8888a8; --text-tertiary: #52526a;
          --accent: #4f8ef7; --accent-light: #93bbff; --accent-bg: rgba(79,142,247,0.1);
          --green: #34d399; --green-bg: rgba(52,211,153,0.08);
          --red: #f87171; --red-bg: rgba(248,113,113,0.08); --orange: #fb923c;
        }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg-root); color: var(--text-primary); -webkit-font-smoothing: antialiased; overflow: hidden; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::placeholder { color: var(--text-tertiary); }
        textarea, input, button, select { font-family: 'DM Sans', sans-serif; }
        @keyframes pulse { 0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-root)', overflow: 'hidden' }}>

        {/* ══ LEFT DASHBOARD ════════════════════════════════════════════════ */}
        <div style={{ width: '58%', height: '100vh', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{
            padding: '13px 24px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'rgba(11,11,24,0.9)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(16px)'
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Forecast Dashboard</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>NatWest Hackathon · AI Predictive Forecasting</div>
            </div>
            {fileName && (
              <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(79,142,247,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(79,142,247,0.2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📄 {fileName}
              </div>
            )}
            <button onClick={() => fileRef.current.click()}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--bg-secondary)'; e.target.style.color = 'var(--text-secondary)' }}>
              {fileName ? 'Change CSV' : '+ Upload CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div style={{ padding: '20px 24px', flex: 1 }}>

            {/* Empty state */}
            {!dashData && !insightsData && !dashLoading && !dashError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '72vh', gap: 16, opacity: 0.45 }}>
                <div style={{ fontSize: 52 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No data yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Upload a CSV with a <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>date</code> column and numeric metrics to get started
                </div>
                <button onClick={() => fileRef.current.click()}
                  style={{ marginTop: 8, padding: '8px 20px', borderRadius: 20, border: '1px solid var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent-light)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Upload CSV
                </button>
              </div>
            )}

            {/* Loading */}
            {dashLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>Running analysis...</span>
              </div>
            )}

            {/* Error */}
            {dashError && (
              <div style={{ padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>❌ {dashError}</div>
            )}

            {/* ── INSIGHTS MODE ──────────────────────────────────────── */}
            {mode === 'insights' && insightsData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.35s ease' }}>

                {/* AI Summary Banner */}
                <div style={{ background: 'linear-gradient(135deg, rgba(79,142,247,0.1), rgba(167,139,250,0.07))', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 7 }}>✦ AI Summary</div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75 }}>{insightsData.ai_summary}</p>
                </div>

                <DataPreview preview={insightsData.preview} rowCount={insightsData.row_count} />
                <ConfidenceBar confidence={insightsData.confidence} />

                {/* 6 Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  <MetricCard label="Latest Revenue" value={`£${lastRevActual?.toLocaleString()}`} sub="Most recent period" accent="blue" icon="💰" />
                  <MetricCard label="Week 1 Forecast" value={`£${firstRevForecast?.toLocaleString()}`} sub={id?.revenue_forecast?.[0]?.date_label || ''} accent="blue" icon="📈" />
                  <MetricCard label={`Growth W${periods}`} value={`${overallRevGrowth >= 0 ? '+' : ''}${overallRevGrowth}%`} sub="vs current avg" accent={overallRevGrowth >= 0 ? 'green' : 'red'} icon={overallRevGrowth >= 0 ? '▲' : '▼'} />
                  <MetricCard label="Best Category" value={bestCat?.category || '—'} sub={bestCat ? `£${bestCat.forecasted_weekly_avg?.toLocaleString()}/wk` : ''} accent="purple" icon="🏆" />
                  <MetricCard label="Region to Watch" value={watchRegion?.region || watchRegion?.value || 'All Stable'} sub={watchRegion ? watchRegion.signal_label : 'No alerts'} accent={watchRegion ? 'orange' : 'green'} icon={watchRegion ? '⚠️' : '✓'} />
                  <MetricCard label="Revenue Anomalies" value={insightsData.revenue_anomalies?.length} sub={anomalySubtext} accent={insightsData.revenue_anomalies?.length > 0 ? 'orange' : 'green'} icon="🔍" />
                </div>

                <CategoryRankings rankings={insightsData.category_rankings} />
                <RegionSignals signals={insightsData.region_signals} />
              </div>
            )}

            {/* ── FORECAST MODE ──────────────────────────────────────── */}
            {mode === 'forecast' && dashData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.35s ease' }}>

                {/* Column Selector */}
                {dashData.numeric_columns?.length > 1 && (
                  <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Column:</span>
                    {dashData.numeric_columns.map(col => (
                      <button key={col} onClick={() => { setSelectedColumn(col); setMainColumn(col); runForecast(col) }} style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        border: `1px solid ${selectedColumn === col ? 'var(--accent)' : 'var(--border-hover)'}`,
                        background: selectedColumn === col ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                        color: selectedColumn === col ? 'var(--accent-light)' : 'var(--text-secondary)',
                        fontWeight: selectedColumn === col ? 600 : 400
                      }}>{col}</button>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>{dashData.row_count} pts</span>
                  </div>
                )}

                <CsvViewer allRows={allCsvRows} rowCount={dashData.row_count} />
                <ConfidenceBar confidence={dashData.confidence} dashData={dashData} />
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT CHAT ════════════════════════════════════════════════════ */}
        <div style={{ width: '42%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

          {/* Chat Header */}
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'rgba(11,11,24,0.9)', backdropFilter: 'blur(16px)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(79,142,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Forecasting Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {mode === 'insights'
                  ? `${insightsData?.categories?.length || 0} categories · ${insightsData?.regions?.length || 0} regions`
                  : dashData ? `Forecasting: ${selectedColumn}` : 'Waiting for data...'}
              </div>
            </div>
            {(dashData || insightsData) && (
              <div style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease-in-out infinite' }} />
                LIVE
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
            {chatLoading && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div>
                <TypingIndicator />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Suggestions */}
          <div style={{ padding: '8px 20px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border-hover)',
                  background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, marginBottom: 5
                }}
                  onMouseEnter={e => { e.target.style.color = 'var(--text-primary)'; e.target.style.borderColor = 'var(--accent)'; e.target.style.background = 'var(--accent-bg)' }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.borderColor = 'var(--border-hover)'; e.target.style.background = 'var(--bg-secondary)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div style={{ padding: '8px 20px 42px', flexShrink: 0, borderTop: '1px solid var(--border)', marginTop: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-hover)', padding: '8px 8px 8px 14px', transition: 'border-color 0.2s' }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'rgba(79,142,247,0.4)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            >
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={mode === 'insights' ? `Ask about ${mainColumn}, categories, regions...` : dashData ? `Ask about ${selectedColumn || 'your data'}...` : 'Upload a CSV to get started...'}
                rows={1} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', resize: 'none', lineHeight: 1.5, paddingTop: 3 }} />
              <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()}
                style={{
                  background: input.trim() ? 'var(--accent)' : 'var(--bg-hover)',
                  color: input.trim() ? '#fff' : 'var(--text-tertiary)',
                  border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12,
                  cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s', flexShrink: 0, fontWeight: 600
                }}>
                Send
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        padding: '7px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#52526a' }}>Your data stays on your server · AI only receives aggregated stats, never raw rows</span>
        </div>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: '#52526a' }}>AI can make mistakes · Please double-check responses</span>
      </div>
    </>
  )
}
