import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, Legend
} from 'recharts'

const API = 'http://127.0.0.1:8000'

// ─── Intent Detection ────────────────────────────────────────────────────────
function detectIntent(message, activeColumn, schema) {
  const msg = message.toLowerCase()
  const weekMatch = msg.match(/(\d+)\s*week/)
  const weeks = weekMatch ? parseInt(weekMatch[1]) : 4
  const pctMatch = msg.match(/([+-]?\d+)\s*%/)
  const pct = pctMatch ? parseInt(pctMatch[1]) : null
  const adjustMatch = msg.match(/(?:grow|increase|drop|decrease|fall|reduce|change).*?(\d+)/)
  const adjustment = pct ?? (adjustMatch ? parseInt(adjustMatch[1]) : 10)
  const isNegative = msg.includes('drop') || msg.includes('decrease') ||
    msg.includes('fall') || msg.includes('reduce') || msg.includes('down')

  // Check if message mentions any specific column or filter value from schema
  // If so, send to /chat for AI-powered parsing
  if (schema) {
    const numericCols = schema.numeric_cols || []
    const categoricalCols = schema.categorical_cols || {}

    const mentionsColumn = numericCols.some(col =>
      msg.includes(col.toLowerCase().replace('_', ' ')) ||
      msg.includes(col.toLowerCase())
    )

    const mentionsFilter = Object.values(categoricalCols).some(vals =>
      vals.some(val => msg.includes(val.toLowerCase()))
    )

    const mentionsCatCol = Object.keys(categoricalCols).some(col =>
      msg.includes(col.toLowerCase().replace('_', ' ')) ||
      msg.includes(col.toLowerCase())
    )

    if (mentionsColumn || mentionsFilter || mentionsCatCol) {
      return { type: 'chat', weeks, column: activeColumn }
    }
  }

  const isKeepTrend = msg.includes('last month') || msg.includes('same trend') || msg.includes('keep the trend')
  if (isKeepTrend) return { type: 'scenario', weeks: 4, adjustment: 0, column: activeColumn }

  if (msg.includes('anomal') || msg.includes('unusual') || msg.includes('spike') || msg.includes('dip') || msg.includes('weird'))
    return { type: 'anomaly', weeks, column: activeColumn }

  if (msg.includes('what if') || msg.includes('scenario') ||
    msg.includes('grow') || msg.includes('increase') ||
    msg.includes('drop') || msg.includes('decrease') || pct !== null)
    return { type: 'scenario', weeks, adjustment: isNegative ? -Math.abs(adjustment) : Math.abs(adjustment), column: activeColumn }

  if (msg.includes('forecast') || msg.includes('predict') || msg.includes('next') || msg.includes('future') || msg.includes('week'))
    return { type: 'forecast', weeks, column: activeColumn }

  return { type: 'chat', weeks: 4, column: activeColumn }
}

// ─── Typing Indicator ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', background: 'var(--bg-card)', borderRadius: '4px 14px 14px 14px', border: '1px solid var(--border)', width: 'fit-content' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent }) {
  const colors = { blue: '#4f8ef7', green: '#34d399', orange: '#fb923c', red: '#f87171', purple: '#a78bfa' }
  const c = colors[accent] || colors.blue
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: c, borderRadius: '3px 0 0 3px' }} />
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Confidence Meter ────────────────────────────────────────────────────────
function ConfidenceMeter({ confidence }) {
  if (!confidence) return null
  const { score, label } = confidence
  const color = score >= 75 ? '#34d399' : score >= 50 ? '#fb923c' : '#f87171'
  const bgColor = score >= 75 ? 'rgba(52,211,153,0.08)' : score >= 50 ? 'rgba(251,146,60,0.08)' : 'rgba(248,113,113,0.08)'
  const borderColor = score >= 75 ? 'rgba(52,211,153,0.2)' : score >= 50 ? 'rgba(251,146,60,0.2)' : 'rgba(248,113,113,0.2)'
  return (
    <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Forecast Confidence</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>/100</span>
            <span style={{ fontSize: 12, fontWeight: 600, color, marginLeft: 4 }}>{label}</span>
          </div>
        </div>
        <div style={{ fontSize: 28 }}>{score >= 75 ? '🎯' : score >= 50 ? '📊' : '⚠️'}</div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
        {score >= 75 ? 'Strong data quality and stable patterns — predictions are reliable'
          : score >= 50 ? 'Moderate confidence — treat forecasts as indicative, not definitive'
          : 'Limited data or high volatility — use forecasts with caution'}
      </div>
    </div>
  )
}

// ─── Custom Anomaly Dot ───────────────────────────────────────────────────────
function AnomalyDot(props) {
  const { cx, cy, payload } = props
  if (!payload?.isAnomaly) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#f87171" stroke="#ff4444" strokeWidth={2} opacity={0.9} />
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="#f87171" strokeWidth={1} opacity={0.4} />
    </g>
  )
}

// ─── Revenue Forecast Chart ───────────────────────────────────────────────────
function RevenueForecastChart({ historical, forecast, anomalies }) {
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = [
    ...historical.slice(-16).map((h, i) => {
      const globalIdx = historical.length - Math.min(16, historical.length) + i
      return { date: h.date?.slice(5), actual: h.value, isAnomaly: anomalyIndices.has(globalIdx) }
    }),
    ...forecast.map(f => ({
      date: f.date_label || `W+${f.period}`,
      likely: f.likely, low: f.low, high: f.high, isAnomaly: false
    }))
  ]
  const tooltipStyle = { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e8e8f0' }
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ ...tooltipStyle, padding: '8px 12px' }}>
        <div style={{ marginBottom: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>{label}</div>
        {payload.map((p, i) => p.value != null && (
          <div key={i} style={{ color: p.color, fontSize: 12 }}>{p.name}: <strong>£{p.value?.toLocaleString()}</strong></div>
        ))}
        {payload[0]?.payload?.isAnomaly && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠ Anomaly detected</div>}
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 9, fill: '#5a5a72' }} axisLine={false} tickLine={false} tickFormatter={v => v ? `£${(v / 1000).toFixed(0)}k` : ''} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="actual" stroke="#4f8ef7" strokeWidth={2} fill="url(#gradRev)" connectNulls name="Historical" dot={<AnomalyDot />} activeDot={{ r: 4 }} />
        <Area type="monotone" dataKey="likely" stroke="#34d399" strokeWidth={2} strokeDasharray="5 3" fill="url(#gradForecast)" dot={{ r: 3, fill: '#34d399' }} connectNulls name="Forecast" />
        <Area type="monotone" dataKey="high" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Upper" />
        <Area type="monotone" dataKey="low" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Lower" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ─── Category Rankings ────────────────────────────────────────────────────────
function CategoryRankings({ rankings }) {
  if (!rankings?.length) return null
  const max = rankings[0]?.forecasted_weekly_avg || 1
  const COLORS = ['#4f8ef7', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#38bdf8']

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Best Performing Category
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>by forecasted revenue</div>
      </div>

      {/* Winner callout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>🏆</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{rankings[0].category}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            £{rankings[0].forecasted_weekly_avg?.toLocaleString()}/week avg · <span style={{ color: rankings[0].growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{rankings[0].growth_pct >= 0 ? '+' : ''}{rankings[0].growth_pct}%</span> growth
          </div>
        </div>
      </div>

      {/* All categories bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rankings.map((cat, i) => (
          <div key={cat.category}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>{cat.category}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: cat.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {cat.growth_pct >= 0 ? '+' : ''}{cat.growth_pct}%
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
                  £{cat.forecasted_weekly_avg?.toLocaleString()}/wk
                </span>
              </div>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(cat.forecasted_weekly_avg / max) * 100}%`,
                background: COLORS[i % COLORS.length],
                borderRadius: 3,
                opacity: i === 0 ? 1 : 0.5
              }} />
            </div>
          </div>
        ))}
      </div>
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
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Region to Watch
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>growth vs prior 4 weeks</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {signals.map(r => {
          const cfg = signalConfig[r.signal] || signalConfig.stable
          return (
            <div key={r.region} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', background: cfg.bg,
              border: `1px solid ${cfg.border}`, borderRadius: 10
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.region}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, padding: '1px 7px', borderRadius: 10, background: `${cfg.bg}`, border: `1px solid ${cfg.border}` }}>
                    {r.signal_label}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Revenue avg £{r.recent_avg_revenue?.toLocaleString()} · {r.anomaly_count > 0 ? `${r.anomaly_count} anomaly detected` : 'No anomalies'}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                {r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Data Preview Table ───────────────────────────────────────────────────────
function DataPreview({ preview, rowCount }) {
  const [open, setOpen] = useState(false)
  if (!preview?.length) return null
  const cols = Object.keys(preview[0])
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data Preview</span>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{rowCount} rows · first 5 shown</span>
        </div>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {cols.map(c => <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  {cols.map(c => (
                    <td key={c} style={{ padding: '8px 12px', color: typeof row[c] === 'number' ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: typeof row[c] === 'number' ? 'inherit' : 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {typeof row[c] === 'number' ? row[c]?.toLocaleString() : row[c]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Chat Message ────────────────────────────────────────────────────────────
function ChatMessage({ msg }) {
  const [tooltip, setTooltip] = useState(null)
  if (msg.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '9px 14px', borderRadius: '14px 14px 4px 14px', fontSize: 13, maxWidth: '80%', lineHeight: 1.6 }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div>
      <div style={{ flex: 1 }}>
        <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '4px 14px 14px 14px', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border)', lineHeight: 1.7 }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
        </div>
        {msg.comparison && (
          <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Scenario <span style={{ color: msg.adjustment > 0 ? 'var(--green)' : 'var(--red)' }}>{msg.adjustment > 0 ? '+' : ''}{msg.adjustment}%</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Week', 'Baseline', 'Scenario', 'Δ'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {msg.comparison.map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--text-tertiary)' }}>W{row.period}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--text-primary)' }}>£{row.baseline?.toLocaleString()}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>£{row.scenario?.toLocaleString()}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: row.difference >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {row.difference >= 0 ? '+' : ''}£{row.difference?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {msg.anomalies && msg.anomalies.length === 0 && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
            ✓ No anomalies detected — data looks clean
          </div>
        )}
        {msg.anomalies?.length > 0 && msg.anomalies.map((a, i) => (
          <div key={i} style={{ marginTop: 8, padding: '10px 12px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
              {a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · Point {a.index}
            </div>
            <div style={{ fontSize: 12, color: '#fca5a5' }}>
              Value <strong>{a.value?.toLocaleString()}</strong> is {Math.abs(a.pct_from_mean)}% {a.direction === 'spike' ? 'above' : 'below'} average · Z={a.z_score}
            </div>
            <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{a.next_step}</div>
          </div>
        ))}

        {msg.categoryRankings?.length > 0 && (
          <div style={{ marginTop: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'visible' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Category Rankings</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(79,142,247,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,142,247,0.2)' }}>Top Revenue</span>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(52,211,153,0.1)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)' }}>Top Growth</span>
              </div>
            </div>
            {msg.categoryRankings.map((cat, i) => {
              const isTopRevenue = cat.category === msg.highestRevenue
              const isTopGrowth = cat.category === msg.highestGrowth
              const last4Avg = cat.current_weekly_avg
              const forecasted = cat.forecasted_weekly_avg
              const diff = forecasted - last4Avg
              return (
                <div key={cat.category} style={{ padding: '10px 14px', borderBottom: i < msg.categoryRankings.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, background: isTopRevenue ? 'rgba(79,142,247,0.04)' : isTopGrowth ? 'rgba(52,211,153,0.04)' : 'transparent' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isTopRevenue ? 'rgba(79,142,247,0.15)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: isTopRevenue ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: isTopRevenue || isTopGrowth ? 600 : 400, color: 'var(--text-primary)' }}>{cat.category}</span>
                      {isTopRevenue && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(79,142,247,0.1)', color: 'var(--accent)', border: '1px solid rgba(79,142,247,0.2)', fontWeight: 600 }}>TOP REVENUE</span>}
                      {isTopGrowth && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(52,211,153,0.1)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 600 }}>TOP GROWTH</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>£{cat.forecasted_weekly_avg?.toLocaleString()}/week forecast</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: cat.growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {cat.growth_pct >= 0 ? '+' : ''}{cat.growth_pct}%
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button
                        onMouseEnter={() => setTooltip(cat.category)}
                        onMouseLeave={() => setTooltip(null)}
                        style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-hover)', border: '1px solid var(--border-hover)', color: 'var(--text-tertiary)', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                        i
                      </button>
                      {tooltip === cat.category && (
                        <div style={{ position: 'absolute', right: 0, bottom: 22, background: '#1e1e30', border: '1px solid var(--border-hover)', borderRadius: 10, padding: '10px 12px', width: 220, zIndex: 100, fontSize: 12, lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, fontSize: 11 }}>How this % is calculated</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Last 4 weeks avg</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>£{last4Avg?.toLocaleString()}/wk</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Forecasted avg</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>£{forecasted?.toLocaleString()}/wk</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-tertiary)' }}>Difference</span>
                            <span style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {diff >= 0 ? '+' : ''}£{Math.abs(diff)?.toLocaleString()} ({cat.growth_pct >= 0 ? '+' : ''}{cat.growth_pct}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {msg.regionSignals?.length > 0 && (
          <div style={{ marginTop: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Region Signals
            </div>
            {msg.regionSignals.map((r, i) => {
              const isWatch = r.watch
              return (
                <div key={r.region} style={{ padding: '10px 14px', borderBottom: i < msg.regionSignals.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, background: isWatch ? 'rgba(248,113,113,0.03)' : 'transparent' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: isWatch ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: isWatch ? 600 : 400, color: 'var(--text-primary)' }}>{r.region}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                      {r.signal_label} · £{r.recent_avg_revenue?.toLocaleString()} avg · {r.anomaly_count} anomaly{r.anomaly_count !== 1 ? 'ies' : 'y'}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                    {r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {msg.forecast && msg.historical && (
          <div style={{ marginTop: 10 }}>
            {msg.filterLabel && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 6, padding: '3px 10px', background: 'var(--accent-bg)', borderRadius: 20, display: 'inline-block', border: '1px solid rgba(79,142,247,0.2)' }}>
                Filtered: {msg.filterLabel}
              </div>
            )}
            {msg.chatColumn && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Column: {msg.chatColumn}
              </div>
            )}
            <RevenueForecastChart
              historical={msg.historical}
              forecast={msg.forecast}
              anomalies={[]}
            />
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Privacy Badge ────────────────────────────────────────────────────────────
function PrivacyBadge() {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', cursor: 'pointer', color: 'var(--green)', fontSize: 11, fontWeight: 500 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
        Data Private
        <span style={{ fontSize: 10, opacity: 0.7 }}>ⓘ</span>
      </button>

      {show && (
        <div style={{ position: 'absolute', top: 32, right: 0, width: 280, background: '#1a1a2e', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '14px 16px', zIndex: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)' }} />
            Data Privacy Guarantee
          </div>
          {[
            ['Raw data', 'Stays on your server only'],
            ['AI receives', 'Aggregated stats only'],
            ['Sent to AI', 'Weekly averages, growth %'],
            ['Never sent', 'Individual rows or records'],
            ['Column names', 'Sent for query understanding'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(52,211,153,0.15)', paddingTop: 8, marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            All forecasting math runs entirely on the backend. Only statistical summaries reach the AI.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function ChatApp() {
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState(null)

  // Two modes: 'insights' (multi-dim) or 'forecast' (simple)
  const [mode, setMode] = useState(null)
  const [insightsData, setInsightsData] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [mainColumn, setMainColumn] = useState('revenue')
  const [dataSchema, setDataSchema] = useState(null)
  const [periods, setPeriods] = useState(4)
  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState(null)

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: "Hi! I'm your forecasting assistant. Upload a CSV to get started. I support both simple forecasts and multi-dimensional datasets with categories and regions — I'll detect which automatically."
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const fileRef = useRef()
  const bottomRef = useRef()
  const dashRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const isMultiDim = (df_cols) => df_cols.includes('product_category') || df_cols.includes('region')

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setDashData(null)
    setInsightsData(null)
    setMode(null)
    setDataSchema(null)

    // Fetch schema first
    const schemaForm = new FormData()
    schemaForm.append('file', f)
    try {
      const schemaRes = await axios.post(`${API}/schema`, schemaForm)
      setDataSchema(schemaRes.data.schema)
      const numCols = schemaRes.data.schema.numeric_cols
      const catCols = Object.keys(schemaRes.data.schema.categorical_cols)
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `Loaded ${f.name}! I found ${numCols.length} numeric columns (${numCols.join(', ')}) and ${catCols.length} filter columns (${catCols.join(', ')}). Running full analysis...`
      }])
    } catch (e) {
      console.log('Schema fetch failed, continuing...')
    }

    setDashLoading(true)
    setDashError(null)

    try {
      const form = new FormData()
      form.append('file', f)

      // Try /insights first (multi-dim), fall back to /forecast
      try {
        const res = await axios.post(`${API}/insights?periods=${periods}`, form)
        setInsightsData(res.data)
        setMode('insights')
        // After successful insights call
        const numericCols = Object.keys(res.data.preview?.[0] || {})
          .filter(k => k !== 'date' && typeof res.data.preview[0][k] === 'number')
        setMainColumn(numericCols[0] || 'revenue')
        setMessages(prev => [...prev, {
          role: 'bot',
          content: `✓ Multi-dimensional dataset detected — ${res.data.categories?.length || 0} categories, ${res.data.regions?.length || 0} regions. Dashboard shows total revenue forecast, category rankings, and region signals. Ask me anything!`
        }])
      } catch {
        // Fall back to simple forecast
        const form2 = new FormData()
        form2.append('file', f)
        const res2 = await axios.post(`${API}/forecast?periods=${periods}`, form2)
        setDashData(res2.data)
        setSelectedColumn(res2.data.selected_column)
        setMode('forecast')
        setMessages(prev => [...prev, {
          role: 'bot',
          content: `✓ Detected ${res2.data.numeric_columns?.length || 1} column(s): ${res2.data.numeric_columns?.join(', ')}. Currently forecasting "${res2.data.selected_column}". Ask me anything!`
        }])
      }
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to read file.'
      setDashError(msg)
      setMessages(prev => [...prev, { role: 'bot', content: `❌ ${msg}` }])
    }
    setDashLoading(false)
  }

  const runForecast = async (col, f = file, p = periods) => {
    if (!f) return
    setDashLoading(true)
    setDashError(null)
    try {
      const form = new FormData()
      form.append('file', f)
      const res = await axios.post(`${API}/forecast?periods=${p}&column=${col}`, form)
      setDashData(res.data)
      setSelectedColumn(res.data.selected_column)
    } catch (e) {
      setDashError(e.response?.data?.detail || 'Forecast failed.')
    }
    setDashLoading(false)
  }

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    if (!file) {
      setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'bot', content: 'Please upload a CSV file using the panel on the left first!' }])
      setInput('')
      return
    }
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setChatLoading(true)
    const intent = detectIntent(msg, selectedColumn || mainColumn, dataSchema)
    try {
      const form = new FormData()
      form.append('file', file)
      if (intent.type === 'chat' || 
          (intent.type === 'forecast' && msg.toLowerCase().includes('in ')) ||
          (intent.type === 'forecast' && msg.toLowerCase().includes('for '))) {
        try {
          const chatForm = new FormData()
          chatForm.append('file', file)
          chatForm.append('question', msg)
          const chatCol = mode === 'insights' ? mainColumn : (selectedColumn || mainColumn || 'revenue')
          const res = await axios.post(`${API}/chat?column=${chatCol}`, chatForm)
          const d = res.data

          const msgL = msg.toLowerCase()
          const wantsSpike = msgL.includes('spike') || msgL.includes('jump') || msgL.includes('surge')
          const wantsDip = msgL.includes('dip') || msgL.includes('drop') || msgL.includes('fall')
          let filteredAnomalies = d.anomalies || []
          if (wantsSpike && !wantsDip) filteredAnomalies = filteredAnomalies.filter(a => a.direction === 'spike')
          else if (wantsDip && !wantsSpike) filteredAnomalies = filteredAnomalies.filter(a => a.direction === 'dip')

          if (d.intent === 'anomaly') {
            setMessages(prev => [...prev, {
              role: 'bot',
              content: filteredAnomalies.length > 0
                ? `Found ${filteredAnomalies.length} anomaly in "${d.column}"${d.filter_label ? ` (${d.filter_label})` : ''}:`
                : `No anomalies detected in "${d.column}"${d.filter_label ? ` (${d.filter_label})` : ''}.`,
              anomalies: filteredAnomalies
            }])
          } else {
            setMessages(prev => [...prev, {
              role: 'bot',
              content: d.ai_summary,
              forecast: d.forecast,
              historical: d.historical,
              chatColumn: d.column,
              filterLabel: d.filter_label,
              confidence: d.confidence
            }])
          }
        } catch (e) {
          setMessages(prev => [...prev, {
            role: 'bot',
            content: `Sorry, I could not process that question. Try rephrasing it, e.g. "forecast units_sold for Electronics in East for next 3 weeks"`
          }])
        }
        setChatLoading(false)
        return
      } else if (intent.type === 'scenario') {
        let res
        const msgLower = msg.toLowerCase()
        const isCategoryQuestion = msgLower.includes('category') || msgLower.includes('best') || msgLower.includes('performing') || msgLower.includes('product')
        const isRegionQuestion = msgLower.includes('region') || msgLower.includes('watch') || msgLower.includes('area') || msgLower.includes('location')

        if (mode === 'insights' && insightsData) {
          if (isCategoryQuestion && insightsData.category_rankings?.length > 0) {
            const rankings = insightsData.category_rankings
            const msg_lower = msg.toLowerCase()
            const highestRevenue = rankings[0]
            const highestGrowth = [...rankings].sort((a, b) => b.growth_pct - a.growth_pct)[0]
            const lowestGrowth = [...rankings].sort((a, b) => a.growth_pct - b.growth_pct)[0]

            let content = ''

            if (msg_lower.includes('focus') || msg_lower.includes('should') || msg_lower.includes('recommend') || msg_lower.includes('invest') || msg_lower.includes('priorit')) {
              content = `Focus on ${highestGrowth.category} — it is the fastest growing category at +${highestGrowth.growth_pct}% and has strong momentum. If you want volume, ${highestRevenue.category} generates the most revenue at £${highestRevenue.forecasted_weekly_avg?.toLocaleString()}/week. Avoid over-investing in ${lowestGrowth.category} which is showing ${lowestGrowth.growth_pct}% growth.`
            } else if (msg_lower.includes('grow') || msg_lower.includes('fastest') || msg_lower.includes('rising') || msg_lower.includes('momentum')) {
              content = `${highestGrowth.category} is growing the fastest at +${highestGrowth.growth_pct}% — this is your highest momentum category right now. Consider increasing investment or marketing here to capitalize on the trend.`
            } else if (msg_lower.includes('revenue') || msg_lower.includes('most money') || msg_lower.includes('highest') || msg_lower.includes('top') || msg_lower.includes('best')) {
              content = `${highestRevenue.category} generates the most revenue at £${highestRevenue.forecasted_weekly_avg?.toLocaleString()}/week. However, note it is showing ${highestRevenue.growth_pct}% growth — strong in size but ${highestRevenue.growth_pct < 0 ? 'declining slightly' : 'growing'}. ${highestGrowth.category} is the fastest growing at +${highestGrowth.growth_pct}% if you care about momentum.`
            } else if (msg_lower.includes('worst') || msg_lower.includes('poor') || msg_lower.includes('bad') || msg_lower.includes('declin') || msg_lower.includes('avoid')) {
              content = `${lowestGrowth.category} is the weakest category at ${lowestGrowth.growth_pct}% growth with £${lowestGrowth.forecasted_weekly_avg?.toLocaleString()}/week forecast. Consider reviewing pricing, stock, or marketing strategy for this category.`
            } else {
              content = `${highestRevenue.category} generates the most revenue at £${highestRevenue.forecasted_weekly_avg?.toLocaleString()}/week, while ${highestGrowth.category} is the fastest growing at +${highestGrowth.growth_pct}%.`
            }

            setMessages(prev => [...prev, {
              role: 'bot',
              content,
              categoryRankings: rankings,
              highestRevenue: highestRevenue.category,
              highestGrowth: highestGrowth.category
            }])
            setChatLoading(false)
            return
          }

          if (isRegionQuestion && insightsData.region_signals?.length > 0) {
            const signals = insightsData.region_signals
            const msg_lower = msg.toLowerCase()

            const declining = signals.filter(r => r.signal === 'decline' || r.signal === 'anomaly_decline')
            const surging = signals.filter(r => r.signal === 'surge' || r.signal === 'anomaly_surge')
            const anomalies = signals.filter(r => r.anomaly_count > 0)
            const stable = signals.filter(r => r.signal === 'stable')

            let answer = ''

            if (msg_lower.includes('declin') || msg_lower.includes('down') || msg_lower.includes('worst') || msg_lower.includes('bad')) {
              if (declining.length > 0) {
                answer = `${declining.map(r => r.region).join(' and ')} ${declining.length > 1 ? 'are' : 'is'} declining — ${declining[0].region} shows ${declining[0].growth_pct}% growth with ${declining[0].anomaly_count} anomalies. Investigate what is driving the drop and consider reallocating resources.`
              } else {
                answer = `No regions are currently declining. All regions are either stable or growing. The lowest growth is ${signals[signals.length - 1]?.region} at ${signals[signals.length - 1]?.growth_pct}%.`
              }
            } else if (msg_lower.includes('surg') || msg_lower.includes('grow') || msg_lower.includes('best') || msg_lower.includes('top')) {
              if (surging.length > 0) {
                answer = `${surging[0].region} is surging the most at +${surging[0].growth_pct}% growth. ${surging.length > 1 ? surging.slice(1).map(r => r.region).join(' and ') + ' are also showing strong growth.' : ''} Focus resources here to capitalize on the momentum.`
              } else {
                answer = `No regions are surging right now. The fastest growing region is ${signals[0]?.region} at ${signals[0]?.growth_pct >= 0 ? '+' : ''}${signals[0]?.growth_pct}%.`
              }
            } else if (msg_lower.includes('anomal') || msg_lower.includes('unusual') || msg_lower.includes('weird') || msg_lower.includes('spike')) {
              if (anomalies.length > 0) {
                answer = `${anomalies.map(r => `${r.region} (${r.anomaly_count} anomalies)`).join(', ')} ${anomalies.length > 1 ? 'have' : 'has'} unusual data points. ${anomalies[0].region} has the most with ${anomalies[0].anomaly_count} anomalies — check for data errors, promotions, or supply issues in that period.`
              } else {
                answer = `No anomalies detected in any region. All regional data looks clean and consistent.`
              }
            } else if (msg_lower.includes('stable') || msg_lower.includes('normal')) {
              if (stable.length > 0) {
                answer = `${stable.map(r => r.region).join(' and ')} ${stable.length > 1 ? 'are' : 'is'} stable with no unusual signals detected.`
              } else {
                answer = `No regions are fully stable right now — all are showing some growth or anomaly signals.`
              }
            } else if (msg_lower.includes('watch') || msg_lower.includes('attention') || msg_lower.includes('focus') || msg_lower.includes('careful')) {
              const watchList = signals.filter(r => r.watch)
              if (watchList.length > 0) {
                answer = `Keep a close eye on ${watchList[0].region} — it shows "${watchList[0].signal_label}" with ${watchList[0].growth_pct >= 0 ? '+' : ''}${watchList[0].growth_pct}% growth and ${watchList[0].anomaly_count} anomalies. ${watchList.length > 1 ? watchList.slice(1).map(r => r.region).join(' and ') + ' also need attention.' : ''}`
              } else {
                answer = `All regions look stable — no urgent areas need immediate attention right now.`
              }
            } else {
              const watchList = signals.filter(r => r.watch)
              answer = watchList.length > 0
                ? `The region to watch is ${watchList[0].region} — "${watchList[0].signal_label}" with ${watchList[0].growth_pct >= 0 ? '+' : ''}${watchList[0].growth_pct}% growth and ${watchList[0].anomaly_count} anomalies.`
                : `All regions are stable with no urgent signals.`
            }

            setMessages(prev => [...prev, {
              role: 'bot',
              content: answer,
              regionSignals: signals
            }])
            setChatLoading(false)
            return
          }
        }

        try {
          const chatForm = new FormData()
          chatForm.append('file', file)
          chatForm.append('question', msg)
          const chatCol = mode === 'insights' ? mainColumn : (selectedColumn || mainColumn)
          res = await axios.post(`${API}/chat?column=${chatCol}`, chatForm)
        } catch {
          const f2 = new FormData()
          f2.append('file', file)
          res = await axios.post(`${API}/forecast?periods=${intent.weeks}&column=${intent.column || selectedColumn || 'revenue'}`, f2)
        }
        const d = res.data
        if (mode === 'forecast') {
          setDashData(d)
          if (d.selected_column) setSelectedColumn(d.selected_column)
        }
        if (intent.type === 'anomaly') {
          const msgL = msg.toLowerCase()
          const wantsSpike = msgL.includes('spike') || msgL.includes('jump') || msgL.includes('surge') || msgL.includes('high')
          const wantsDip = msgL.includes('dip') || msgL.includes('drop') || msgL.includes('fall') || msgL.includes('low') || msgL.includes('declin')

          let filteredAnomalies = d.anomalies || []
          let filterLabel = ''

          if (wantsSpike && !wantsDip) {
            filteredAnomalies = filteredAnomalies.filter(a => a.direction === 'spike')
            filterLabel = 'spike'
          } else if (wantsDip && !wantsSpike) {
            filteredAnomalies = filteredAnomalies.filter(a => a.direction === 'dip')
            filterLabel = 'dip'
          }

          const col = d.selected_column || selectedColumn
          let content = ''

          if (filteredAnomalies.length === 0 && filterLabel) {
            content = `No sudden ${filterLabel}s detected in "${col}" — the data looks stable with no ${filterLabel}s outside the expected range.`
          } else if (filteredAnomalies.length === 0) {
            content = `No anomalies detected in "${col}" — data looks clean!`
          } else if (filterLabel === 'spike') {
            content = `Found ${filteredAnomalies.length} sudden spike${filteredAnomalies.length > 1 ? 's' : ''} in "${col}" — values jumped significantly above the expected range:`
          } else if (filterLabel === 'dip') {
            content = `Found ${filteredAnomalies.length} sudden dip${filteredAnomalies.length > 1 ? 's' : ''} in "${col}" — values dropped significantly below the expected range:`
          } else {
            content = `Found ${filteredAnomalies.length} anomaly${filteredAnomalies.length > 1 ? 'ies' : 'y'} in "${col}":`
          }

          setMessages(prev => [...prev, {
            role: 'bot',
            content,
            anomalies: filteredAnomalies
          }])
        } else {
          const filterInfo = d.filter_label ? ` (filtered: ${d.filter_label})` : ''
          setMessages(prev => [...prev, {
            role: 'bot',
            content: d.ai_summary,
            forecast: d.forecast,
            historical: d.historical,
            chatColumn: d.column,
            filterLabel: d.filter_label,
            confidence: d.confidence
          }])
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Something went wrong. Make sure the backend is running and try again.' }])
    }
    setChatLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const suggestions = mode === 'insights'
    ? [
        `Forecast total ${mainColumn} next 4 weeks`,
        'Any sudden spikes I should look at?',
        `What if ${mainColumn} increases by 10%?`,
        'Which category should I focus on?',
        'Which region is declining?',
        'What if we keep last month\'s trend?'
      ]
    : selectedColumn
      ? [
          `Forecast ${selectedColumn} next 4 weeks`,
          `Any anomalies in ${selectedColumn}?`,
          `What if ${selectedColumn} grows by 20%?`,
          `What if ${selectedColumn} drops by 15%?`,
        ]
      : ['Forecast next 4 weeks', 'Any anomalies?', 'What if sales grow by 20%?']

  // Derived metrics for insights mode
  const id = insightsData
  const lastRevActual = id?.revenue_historical?.[id.revenue_historical.length - 1]?.value
  const firstRevForecast = id?.revenue_forecast?.[0]?.likely
  const overallRevGrowth = id?.revenue_forecast?.[id.revenue_forecast.length - 1]?.growth_pct
  const watchRegion = id?.region_signals?.find(r => r.watch)
  const bestCat = id?.category_rankings?.[0]

  // Simple mode metrics
  const lastActual = dashData?.historical?.[dashData.historical.length - 1]?.value
  const firstForecast = dashData?.forecast?.[0]?.likely
  const overallGrowth = dashData?.forecast?.[dashData.forecast.length - 1]?.growth_pct

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg-root: #080810; --bg-primary: #0c0c18; --bg-secondary: #10101e;
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
        input[type=range] { -webkit-appearance: none; width: 100%; height: 3px; border-radius: 3px; background: var(--border-hover); outline: none; cursor: pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); cursor: pointer; }
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-root)', overflow: 'hidden' }}>

        {/* ══ LEFT DASHBOARD ════════════════════════════════════════════════ */}
        <div ref={dashRef} style={{ width: '58%', height: '100vh', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

          {/* Header */}
          <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Forecast Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>NatWest Hackathon · AI Predictive Forecasting</div>
              <div style={{ fontSize: 10, color: 'var(--green)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
                Raw data never leaves your server
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PrivacyBadge />
              {fileName && <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>}
              {(dashData || insightsData) && (
                <select value={periods} onChange={e => {
                  const p = Number(e.target.value); setPeriods(p)
                  if (mode === 'forecast') runForecast(selectedColumn, file, p)
                }} style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                  {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}w forecast</option>)}
                </select>
              )}
              <button onClick={() => fileRef.current.click()}
                style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { e.target.style.background = 'var(--bg-secondary)'; e.target.style.color = 'var(--text-secondary)' }}>
                {fileName ? 'Change CSV' : '+ Upload CSV'}
              </button>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px 28px', flex: 1 }}>

            {/* Empty */}
            {!dashData && !insightsData && !dashLoading && !dashError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 14, opacity: 0.4 }}>
                <div style={{ fontSize: 52 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No data yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Upload a CSV. Supports simple forecasts or multi-dimensional datasets with product_category and region columns.
                </div>
              </div>
            )}

            {/* Loading */}
            {dashLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1s ease-in-out ${i*0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>Running analysis...</span>
              </div>
            )}

            {/* Error */}
            {dashError && <div style={{ padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>❌ {dashError}</div>}

            {/* ── INSIGHTS MODE (multi-dim) ─────────────────────────────── */}
            {mode === 'insights' && insightsData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>

                {/* AI One-Liner */}
                <div style={{ background: 'linear-gradient(135deg, rgba(79,142,247,0.12), rgba(167,139,250,0.08))', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>✦ AI Insight</div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75, fontStyle: 'italic' }}>{insightsData.ai_summary}</p>
                </div>

                {/* Data Preview */}
                <DataPreview preview={insightsData.preview} rowCount={insightsData.row_count} />

                {/* Confidence */}
                <ConfidenceMeter confidence={insightsData.confidence} />

                {/* Key Metric Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                  <MetricCard label="Latest Revenue" value={`£${lastRevActual?.toLocaleString()}`} sub="Most recent week total" accent="blue" />
                  <MetricCard label="Week 1 Forecast" value={`£${firstRevForecast?.toLocaleString()}`} sub={id?.revenue_forecast?.[0]?.date_label || 'Next week'} accent="blue" />
                  <MetricCard label={`Revenue Growth W${periods}`} value={`${overallRevGrowth >= 0 ? '+' : ''}${overallRevGrowth}%`} sub="vs current" accent={overallRevGrowth >= 0 ? 'green' : 'red'} />
                  <MetricCard label="Best Category" value={bestCat?.category || '—'} sub={bestCat ? `£${bestCat.forecasted_weekly_avg?.toLocaleString()}/wk` : ''} accent="purple" />
                  <MetricCard label="Region to Watch" value={watchRegion?.region || 'All Stable'} sub={watchRegion ? watchRegion.signal_label : 'No alerts'} accent={watchRegion ? 'orange' : 'green'} />
                  <MetricCard label="Revenue Anomalies" value={insightsData.revenue_anomalies?.length} sub="In total revenue series" accent={insightsData.revenue_anomalies?.length > 0 ? 'orange' : 'green'} />
                </div>

                {/* Total Revenue Chart */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue Forecast</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>All categories · all regions combined</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([label, color]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
                        </div>
                      ))}
                      {insightsData.revenue_anomalies?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Anomaly</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <RevenueForecastChart historical={insightsData.revenue_historical} forecast={insightsData.revenue_forecast} anomalies={insightsData.revenue_anomalies} />
                </div>

              </div>
            )}

            {/* ── SIMPLE FORECAST MODE ──────────────────────────────────── */}
            {mode === 'forecast' && dashData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>

                {/* Column Selector */}
                {dashData.numeric_columns?.length > 1 && (
                  <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Column:</span>
                    {dashData.numeric_columns.map(col => (
                      <button key={col} onClick={() => { setSelectedColumn(col); runForecast(col) }} style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        border: `1px solid ${selectedColumn === col ? 'var(--accent)' : 'var(--border-hover)'}`,
                        background: selectedColumn === col ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                        color: selectedColumn === col ? 'var(--accent-light)' : 'var(--text-secondary)',
                        fontWeight: selectedColumn === col ? 600 : 400
                      }}>{col}</button>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dashData.row_count} points</span>
                  </div>
                )}

                <DataPreview preview={dashData.preview} rowCount={dashData.row_count} />
                <ConfidenceMeter confidence={dashData.confidence} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                  <MetricCard label="Model Used" value={dashData.model_used?.split(' ')[0]} sub={dashData.model_used} accent="purple" />
                  <MetricCard label="Latest Value" value={lastActual?.toLocaleString()} sub="Most recent data point" accent="blue" />
                  <MetricCard label="Week 1 Forecast" value={firstForecast?.toLocaleString()} sub={dashData.forecast?.[0]?.date_label || 'Central estimate'} accent="blue" />
                  <MetricCard label={`Growth by Week ${periods}`} value={`${overallGrowth >= 0 ? '+' : ''}${overallGrowth}%`} sub="vs current value" accent={overallGrowth >= 0 ? 'green' : 'red'} />
                  <MetricCard label="Anomalies Found" value={dashData.anomalies?.length} sub="Highlighted on chart" accent={dashData.anomalies?.length > 0 ? 'orange' : 'green'} />
                  {dashData.seasonality_period && <MetricCard label="Seasonality" value={dashData.seasonality_period === 7 ? 'Weekly' : 'Monthly'} sub="Pattern detected" accent="purple" />}
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forecast Chart</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([label, color]) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
                        </div>
                      ))}
                      {dashData.anomalies?.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Anomaly</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <RevenueForecastChart historical={dashData.historical} forecast={dashData.forecast} anomalies={dashData.anomalies} />
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Anomaly Detection</div>
                  {dashData.anomalies?.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--green)' }}>
                      ✓ No anomalies detected — data looks clean
                    </div>
                  ) : (
                    dashData.anomalies.map((a, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: '12px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                          {a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · Point {a.index}
                        </div>
                        <div style={{ fontSize: 13, color: '#fca5a5' }}>
                          Value <strong>{a.value?.toLocaleString()}</strong> is {Math.abs(a.pct_from_mean)}% {a.direction === 'spike' ? 'above' : 'below'} average · Z-score: {a.z_score}
                        </div>
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 6, padding: '5px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>{a.next_step}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT CHAT ════════════════════════════════════════════════════ */}
        <div style={{ width: '42%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>AI</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Forecasting Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {mode === 'insights' ? `Multi-dim · ${insightsData?.categories?.length || 0} categories · ${insightsData?.regions?.length || 0} regions`
                  : dashData ? `Forecasting: ${selectedColumn}` : 'Waiting for data...'}
              </div>
            </div>
            {(dashData || insightsData) && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 600 }}>● LIVE</div>
                <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(52,211,153,0.06)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)' }} />
                  Data Private
                </div>
              </div>
            )}
          </div>

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

          <div style={{ padding: '12px 20px 20px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  fontSize: 11, padding: '4px 11px', borderRadius: 20, border: '1px solid var(--border-hover)',
                  background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200
                }}
                  onMouseEnter={e => { e.target.style.color = 'var(--text-primary)'; e.target.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.borderColor = 'var(--border-hover)' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-hover)', padding: '8px 8px 8px 14px' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={mode === 'insights' ? 'Ask about revenue, categories, regions, what-if...' : dashData ? `Ask about ${selectedColumn}...` : 'Upload a CSV to get started...'}
                rows={1} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', resize: 'none', lineHeight: 1.5, paddingTop: 3 }} />
              <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()}
                style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: input.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s', flexShrink: 0, fontWeight: 600 }}>
                Send
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
