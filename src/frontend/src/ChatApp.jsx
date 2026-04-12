import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar, Cell
} from 'recharts'

const API = 'http://127.0.0.1:8000'
const COLORS = ['#4f8ef7', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#38bdf8']

// ─── Shared chart tooltip style ───────────────────────────────────────────────
const TT_STYLE = { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e8e8f0' }

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
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-hover)', color: 'var(--text-tertiary)' }}>{rowCount} rows · first 5</span>
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
                    <td key={c} style={{ padding: '8px 12px', color: typeof row[c] === 'number' ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap' }}>
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

// ─── Anomaly Dot ─────────────────────────────────────────────────────────────
function AnomalyDot({ cx, cy, payload }) {
  if (!payload?.isAnomaly) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#f87171" stroke="#ff4444" strokeWidth={2} opacity={0.9} />
      <circle cx={cx} cy={cy} r={11} fill="none" stroke="#f87171" strokeWidth={1} opacity={0.35} />
    </g>
  )
}

// ─── INLINE: Forecast Chart (Q1, Q2) ─────────────────────────────────────────
function InlineForecastChart({ historical, forecast, anomalies, metric, filterLabel, compact = false }) {
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const h = compact ? 160 : 200
  const chartData = [
    ...historical.slice(-16).map((pt, i) => {
      const globalIdx = historical.length - Math.min(16, historical.length) + i
      return { date: pt.date?.slice(5), actual: pt.value, isAnomaly: anomalyIndices.has(globalIdx) }
    }),
    ...forecast.map(f => ({ date: f.date_label || `W+${f.period}`, likely: f.likely, low: f.low, high: f.high }))
  ]
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ ...TT_STYLE, padding: '8px 12px' }}>
        <div style={{ marginBottom: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>{label}</div>
        {payload.map((p, i) => p.value != null && <div key={i} style={{ color: p.color, fontSize: 12 }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>)}
        {payload[0]?.payload?.isAnomaly && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠ Anomaly</div>}
      </div>
    )
  }
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
      <ResponsiveContainer width="100%" height={h}>
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
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="actual" stroke="#4f8ef7" strokeWidth={2} fill={`url(#gA-${metric})`} connectNulls name="Historical" dot={<AnomalyDot />} activeDot={{ r: 4 }} />
          <Area type="monotone" dataKey="likely" stroke="#34d399" strokeWidth={2} strokeDasharray="5 3" fill={`url(#gF-${metric})`} dot={{ r: 3, fill: '#34d399' }} connectNulls name="Forecast" />
          <Area type="monotone" dataKey="high" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Upper" />
          <Area type="monotone" dataKey="low" stroke="#fb923c" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} connectNulls name="Lower" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── INLINE: Anomaly Chart (Q4, Q5) ──────────────────────────────────────────
function InlineAnomalyChart({ historical, anomalies, metric, filterLabel }) {
  if (!historical?.length) return null
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = historical.map((h, i) => ({
    date: h.date?.slice(5),
    value: h.value,
    isAnomaly: anomalyIndices.has(i),
    anomalyValue: anomalyIndices.has(i) ? h.value : null
  }))
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 8px 8px', border: '1px solid var(--border)' }}>
      {filterLabel && <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 6, paddingLeft: 8 }}>Filtered: {filterLabel}</div>}
      <div style={{ display: 'flex', gap: 12, paddingLeft: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f8ef7' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{metric}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Anomaly</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
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

// ─── INLINE: Rankings Chart (Q3) ─────────────────────────────────────────────
function InlineRankingsChart({ rankings, dimension }) {
  if (!rankings?.length) return null
  const dimLabel = dimension === 'product_category' ? 'category' : 'region'
  const max = rankings[0]?.forecasted_weekly_avg || 1
  return (
    <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        By {dimLabel} — forecasted weekly avg
      </div>
      {/* Winner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🏆</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{rankings[0].value}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {rankings[0].forecasted_weekly_avg?.toLocaleString()}/wk · <span style={{ color: rankings[0].growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{rankings[0].growth_pct >= 0 ? '+' : ''}{rankings[0].growth_pct}% growth</span>
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

// ─── INLINE: Dimension Signals (Q6) ──────────────────────────────────────────
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
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        {dimLabel} signals — ranked by activity
      </div>
      {signals.map((s, i) => {
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

// ─── INLINE: Scenario Table (Q7, Q8) ─────────────────────────────────────────
function InlineScenarioTable({ comparison, adjustment, metric }) {
  if (!comparison?.length) return null
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {metric} scenario
        <span style={{ color: adjustment > 0 ? 'var(--green)' : adjustment < 0 ? 'var(--red)' : 'var(--text-tertiary)', fontWeight: 700 }}>
          {adjustment === 0 ? ' (flat trend)' : ` (${adjustment > 0 ? '+' : ''}${adjustment}%)`}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            {['Date', 'Baseline', 'Scenario', 'Difference'].map(h => (
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

// ─── INLINE: Best vs Worst Table (Q9) ────────────────────────────────────────
function InlineBestWorstTable({ bestForecast, worstForecast, baselineForecast, metric }) {
  if (!bestForecast?.length || !worstForecast?.length) return null
  const bestTotal = bestForecast.reduce((s, f) => s + f.likely, 0)
  const worstTotal = worstForecast.reduce((s, f) => s + f.likely, 0)
  const baseTotal = baselineForecast?.reduce((s, f) => s + f.likely, 0) || 0
  return (
    <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
        {metric} — best case (+20%) vs worst case (-20%)
      </div>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'Best Case', value: bestTotal, color: 'var(--green)' },
          { label: 'Baseline', value: baseTotal, color: 'var(--accent)' },
          { label: 'Worst Case', value: worstTotal, color: 'var(--red)' }
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px 12px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color }}>{value?.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>total {bestForecast.length}wk</div>
          </div>
        ))}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
            {['Date', 'Best', 'Baseline', 'Worst', 'Gap'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bestForecast.map((b, i) => {
            const w = worstForecast[i] || {}
            const bl = baselineForecast?.[i] || {}
            const gap = b.likely - (w.likely || 0)
            return (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{b.date_label || `W${b.period}`}</td>
                <td style={{ padding: '6px 10px', color: 'var(--green)', fontWeight: 600 }}>{b.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{bl.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--red)', fontWeight: 600 }}>{w.likely?.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-tertiary)' }}>{gap?.toLocaleString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Dashboard: Forecast Chart (used in both modes) ──────────────────────────
function DashForecastChart({ historical, forecast, anomalies }) {
  const anomalyIndices = new Set((anomalies || []).map(a => a.index))
  const chartData = [
    ...historical.slice(-16).map((h, i) => {
      const globalIdx = historical.length - Math.min(16, historical.length) + i
      return { date: h.date?.slice(5), actual: h.value, isAnomaly: anomalyIndices.has(globalIdx) }
    }),
    ...forecast.map(f => ({ date: f.date_label || `W+${f.period}`, likely: f.likely, low: f.low, high: f.high }))
  ]
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ ...TT_STYLE, padding: '8px 12px' }}>
        <div style={{ marginBottom: 4, color: 'var(--text-tertiary)', fontSize: 11 }}>{label}</div>
        {payload.map((p, i) => p.value != null && <div key={i} style={{ color: p.color, fontSize: 12 }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>)}
        {payload[0]?.payload?.isAnomaly && <div style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠ Anomaly</div>}
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="dA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.2} /><stop offset="95%" stopColor="#4f8ef7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dF" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.15} /><stop offset="95%" stopColor="#34d399" stopOpacity={0} />
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

// ─── Dashboard: Category Rankings ────────────────────────────────────────────
function CategoryRankings({ rankings }) {
  if (!rankings?.length) return null
  const max = rankings[0]?.forecasted_weekly_avg || 1
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Best Performing Category</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.18)', borderRadius: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>🏆</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{rankings[0].category}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
            £{rankings[0].forecasted_weekly_avg?.toLocaleString()}/wk · <span style={{ color: rankings[0].growth_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>{rankings[0].growth_pct >= 0 ? '+' : ''}{rankings[0].growth_pct}%</span>
          </div>
        </div>
      </div>
      {rankings.map((cat, i) => (
        <div key={cat.category} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>{cat.category}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: cat.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{cat.growth_pct >= 0 ? '+' : ''}{cat.growth_pct}%</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>£{cat.forecasted_weekly_avg?.toLocaleString()}/wk</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(cat.forecasted_weekly_avg / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, opacity: i === 0 ? 1 : 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Dashboard: Region Signals ────────────────────────────────────────────────
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
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>Region to Watch</div>
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
                Avg £{(r.recent_avg_revenue || r.recent_avg)?.toLocaleString()} · {r.anomaly_count > 0 ? `${r.anomaly_count} anomaly` : 'No anomalies'}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
              {r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
function ChatMessage({ msg, onUpdateDashboard }) {
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
        {/* Text bubble */}
        <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '4px 14px 14px 14px', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border)', lineHeight: 1.75 }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
        </div>

        {/* Filter label pill */}
        {d.filter_label && (
          <div style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: 'var(--accent)', padding: '2px 10px', background: 'var(--accent-bg)', borderRadius: 20, border: '1px solid rgba(79,142,247,0.2)' }}>
            Filtered: {d.filter_label}
          </div>
        )}

        {/* Q1/Q2: Forecast chart */}
        {d.graph_type === 'forecast' && d.historical && d.forecast && (
          <InlineForecastChart
            historical={d.historical}
            forecast={d.forecast}
            anomalies={d.anomalies}
            metric={d.metric}
            filterLabel={d.filter_label}
          />
        )}

        {/* Q3: Rankings */}
        {d.graph_type === 'rankings' && d.rankings && (
          <InlineRankingsChart rankings={d.rankings} dimension={d.dimension} />
        )}

        {/* Q4/Q5: Anomaly chart */}
        {d.graph_type === 'anomaly' && d.historical && (
          <>
            <InlineAnomalyChart historical={d.historical} anomalies={d.anomalies} metric={d.metric} filterLabel={d.filter_label} />
            {/* Anomaly cards */}
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

        {/* Q6: Dimension signals */}
        {d.graph_type === 'dimension_signals' && d.signals && (
          <InlineDimensionSignals signals={d.signals} dimension={d.dimension} />
        )}

        {/* Q7/Q8: Scenario table */}
        {d.graph_type === 'scenario' && d.comparison && (
          <InlineScenarioTable comparison={d.comparison} adjustment={d.adjustment_pct} metric={d.metric} />
        )}

        {/* Q9: Best vs Worst */}
        {d.graph_type === 'best_worst' && d.best_forecast && (
          <InlineBestWorstTable
            bestForecast={d.best_forecast}
            worstForecast={d.worst_forecast}
            baselineForecast={d.baseline_forecast}
            metric={d.metric}
          />
        )}

        {/* Confidence meter for forecast responses */}
        {d.graph_type === 'forecast' && d.confidence && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Confidence:</div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.confidence.score}%`, background: d.confidence.score >= 75 ? '#34d399' : d.confidence.score >= 50 ? '#fb923c' : '#f87171', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: d.confidence.score >= 75 ? 'var(--green)' : d.confidence.score >= 50 ? 'var(--orange)' : 'var(--red)' }}>{d.confidence.score}/100 {d.confidence.label}</div>
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
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(52,211,153,0.25)', background: 'rgba(52,211,153,0.08)', cursor: 'pointer', color: 'var(--green)', fontSize: 11, fontWeight: 500 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
        Data Private
      </button>
      {show && (
        <div style={{ position: 'absolute', top: 32, right: 0, width: 260, background: '#1a1a2e', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '14px 16px', zIndex: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 10 }}>🔒 Data Privacy</div>
          {[['Raw data', 'Stays on your server only'], ['AI receives', 'Aggregated stats only'], ['Never sent', 'Individual rows or records']].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{l}</span>
              <span style={{ fontSize: 11, color: 'var(--text-primary)', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function ChatApp() {
  const [file, setFile] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [mode, setMode] = useState(null)           // 'insights' | 'forecast'
  const [insightsData, setInsightsData] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [selectedColumn, setSelectedColumn] = useState(null)
  const [mainColumn, setMainColumn] = useState('revenue')
  const [dataSchema, setDataSchema] = useState(null)
  const [periods, setPeriods] = useState(4)
  const [dashLoading, setDashLoading] = useState(false)
  const [dashError, setDashError] = useState(null)

  // Live dashboard update from chat responses
  const [liveChart, setLiveChart] = useState(null)  // {historical, forecast, anomalies, metric}

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: "Hi! I'm your forecasting assistant. Upload a CSV to get started — I support forecasting, anomaly detection, and scenario analysis across any metric, category, or region.",
    data: {}
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const fileRef = useRef()
  const bottomRef = useRef()
  const dashRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const handleFile = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setFileName(f.name)
    setDashData(null)
    setInsightsData(null)
    setMode(null)
    setLiveChart(null)
    setDataSchema(null)

    setMessages(prev => [...prev, { role: 'bot', content: `📂 Loaded ${f.name}. Detecting dataset type and running analysis...`, data: {} }])
    setDashLoading(true)
    setDashError(null)

    // Fetch schema
    try {
      const sf = new FormData(); sf.append('file', f)
      const sr = await axios.post(`${API}/schema`, sf)
      setDataSchema(sr.data.schema)
    } catch {}

    // Try insights first, fall back to forecast
    try {
      const form = new FormData(); form.append('file', f)
      try {
        const res = await axios.post(`${API}/insights?periods=${periods}`, form)
        setInsightsData(res.data)
        setMode('insights')
        setMainColumn('revenue')
        setDataSchema(res.data.schema || dataSchema)
        setMessages(prev => [...prev, {
          role: 'bot',
          content: `✓ Multi-dimensional dataset — ${res.data.categories?.length || 0} categories, ${res.data.regions?.length || 0} regions. Dashboard loaded. Ask me anything!`,
          data: {}
        }])
      } catch {
        const f2 = new FormData(); f2.append('file', f)
        const res2 = await axios.post(`${API}/forecast?periods=${periods}`, f2)
        setDashData(res2.data)
        setSelectedColumn(res2.data.selected_column)
        setMainColumn(res2.data.selected_column || 'value')
        setMode('forecast')
        setMessages(prev => [...prev, {
          role: 'bot',
          content: `✓ Detected columns: ${res2.data.numeric_columns?.join(', ')}. Currently forecasting "${res2.data.selected_column}".`,
          data: {}
        }])
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to read file.'
      setDashError(msg)
      setMessages(prev => [...prev, { role: 'bot', content: `❌ ${msg}`, data: {} }])
    }
    setDashLoading(false)
  }

  const runForecast = async (col, f = file, p = periods) => {
    if (!f) return
    setDashLoading(true)
    setDashError(null)
    try {
      const form = new FormData(); form.append('file', f)
      const res = await axios.post(`${API}/forecast?periods=${p}&column=${col}`, form)
      setDashData(res.data)
      setSelectedColumn(res.data.selected_column)
    } catch (e) { setDashError(e.response?.data?.detail || 'Forecast failed.') }
    setDashLoading(false)
  }

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg) return
    if (!file) {
      setMessages(prev => [...prev,
        { role: 'user', content: msg },
        { role: 'bot', content: 'Please upload a CSV file first!', data: {} }
      ])
      setInput('')
      return
    }
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setInput('')
    setChatLoading(true)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('question', msg)
      const col = mode === 'insights' ? mainColumn : (selectedColumn || mainColumn || 'revenue')
      const res = await axios.post(`${API}/chat?column=${col}`, form)
      const d = res.data

      // Update live chart on dashboard for forecast/anomaly responses
      if (d.graph_type === 'forecast' && d.historical && d.forecast) {
        setLiveChart({ historical: d.historical, forecast: d.forecast, anomalies: d.anomalies || [], metric: d.metric })
      } else if (d.graph_type === 'anomaly' && d.historical) {
        setLiveChart({ historical: d.historical, forecast: [], anomalies: d.anomalies || [], metric: d.metric })
      }

      setMessages(prev => [...prev, {
        role: 'bot',
        content: d.ai_summary || 'Done — see the chart below.',
        data: {
          graph_type: d.graph_type,
          metric: d.metric,
          filter_label: d.filter_label,
          // forecast
          forecast: d.forecast,
          historical: d.historical,
          anomalies: d.anomalies,
          confidence: d.confidence,
          model_used: d.model_used,
          // rankings
          rankings: d.rankings,
          dimension: d.dimension,
          // signals
          signals: d.signals,
          // scenario
          comparison: d.comparison,
          adjustment_pct: d.adjustment_pct,
          // best/worst
          best_forecast: d.best_forecast,
          worst_forecast: d.worst_forecast,
          baseline_forecast: d.baseline_forecast,
        }
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Something went wrong. Make sure the backend is running.', data: {} }])
    }
    setChatLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const suggestions = mode === 'insights'
    ? [
        `What will ${mainColumn} look like next 4 weeks?`,
        'Which category performs best next month?',
        'Which region has the most unusual activity?',
        'Any sudden spikes in revenue?',
        `What if ${mainColumn} grows by 10%?`,
        'Show best case vs worst case for revenue'
      ]
    : selectedColumn
      ? [`Forecast ${selectedColumn} next 4 weeks`, `Any anomalies in ${selectedColumn}?`, `What if ${selectedColumn} grows by 20%?`, 'Show best case vs worst case']
      : ['Forecast next 4 weeks', 'Any anomalies?', 'What if sales grow by 20%?']

  const id = insightsData
  const lastRevActual = id?.revenue_historical?.[id.revenue_historical.length - 1]?.value
  const firstRevForecast = id?.revenue_forecast?.[0]?.likely
  const overallRevGrowth = id?.revenue_forecast?.[id.revenue_forecast.length - 1]?.growth_pct
  const watchRegion = id?.region_signals?.find(r => r.watch)
  const bestCat = id?.category_rankings?.[0]
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
        @keyframes bounce { 0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-root)', overflow: 'hidden' }}>

        {/* ══ LEFT DASHBOARD ════════════════════════════════════════════════ */}
        <div ref={dashRef} style={{ width: '58%', height: '100vh', overflowY: 'auto', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

          {/* Header */}
          <div style={{ padding: '14px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Forecast Dashboard</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>NatWest Hackathon · AI Predictive Forecasting</div>
            </div>
            <PrivacyBadge />
            {fileName && <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>}
            {(dashData || insightsData) && (
              <select value={periods} onChange={e => { const p = Number(e.target.value); setPeriods(p); if (mode === 'forecast') runForecast(selectedColumn, file, p) }}
                style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                {[2,3,4,5,6].map(n => <option key={n} value={n}>{n}w</option>)}
              </select>
            )}
            <button onClick={() => fileRef.current.click()}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--bg-secondary)'; e.target.style.color = 'var(--text-secondary)' }}>
              {fileName ? 'Change CSV' : '+ Upload CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* Body */}
          <div style={{ padding: '20px 28px', flex: 1 }}>

            {!dashData && !insightsData && !dashLoading && !dashError && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 14, opacity: 0.4 }}>
                <div style={{ fontSize: 52 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>No data yet</div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                  Upload a CSV with date, product_category, region, and numeric columns
                </div>
              </div>
            )}

            {dashLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8 }}>
                {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `bounce 1s ease-in-out ${i*0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>Running analysis...</span>
              </div>
            )}

            {dashError && <div style={{ padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>❌ {dashError}</div>}

            {/* ── INSIGHTS MODE ─────────────────────────────────────────── */}
            {mode === 'insights' && insightsData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>

                {/* AI One-liner */}
                <div style={{ background: 'linear-gradient(135deg, rgba(79,142,247,0.12), rgba(167,139,250,0.08))', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>✦ AI Insight</div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.75, fontStyle: 'italic' }}>{insightsData.ai_summary}</p>
                </div>

                <DataPreview preview={insightsData.preview} rowCount={insightsData.row_count} />
                <ConfidenceMeter confidence={insightsData.confidence} />

                {/* Metric cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                  <MetricCard label="Latest Revenue" value={`£${lastRevActual?.toLocaleString()}`} sub="Most recent week" accent="blue" />
                  <MetricCard label="Week 1 Forecast" value={`£${firstRevForecast?.toLocaleString()}`} sub={id?.revenue_forecast?.[0]?.date_label || ''} accent="blue" />
                  <MetricCard label={`Growth W${periods}`} value={`${overallRevGrowth >= 0 ? '+' : ''}${overallRevGrowth}%`} sub="vs current" accent={overallRevGrowth >= 0 ? 'green' : 'red'} />
                  <MetricCard label="Best Category" value={bestCat?.category || '—'} sub={bestCat ? `£${bestCat.forecasted_weekly_avg?.toLocaleString()}/wk` : ''} accent="purple" />
                  <MetricCard label="Region to Watch" value={watchRegion?.region || watchRegion?.value || 'All Stable'} sub={watchRegion ? watchRegion.signal_label : 'No alerts'} accent={watchRegion ? 'orange' : 'green'} />
                  <MetricCard label="Revenue Anomalies" value={insightsData.revenue_anomalies?.length} sub="In total revenue" accent={insightsData.revenue_anomalies?.length > 0 ? 'orange' : 'green'} />
                </div>

                {/* Live chart — updates when chat returns forecast/anomaly */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {liveChart ? `${liveChart.metric} — from last query` : 'Total Revenue Forecast'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {liveChart ? 'Updates with each chat query' : 'All categories · all regions'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([l, c]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l}</span>
                        </div>
                      ))}
                      {(liveChart?.anomalies?.length > 0 || insightsData.revenue_anomalies?.length > 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 4px #f87171' }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Anomaly</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <DashForecastChart
                    historical={liveChart?.historical || insightsData.revenue_historical}
                    forecast={liveChart?.forecast?.length ? liveChart.forecast : insightsData.revenue_forecast}
                    anomalies={liveChart?.anomalies || insightsData.revenue_anomalies}
                  />
                </div>

                <CategoryRankings rankings={insightsData.category_rankings} />
                <RegionSignals signals={insightsData.region_signals} />
              </div>
            )}

            {/* ── SIMPLE FORECAST MODE ──────────────────────────────────── */}
            {mode === 'forecast' && dashData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>

                {dashData.numeric_columns?.length > 1 && (
                  <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Column:</span>
                    {dashData.numeric_columns.map(col => (
                      <button key={col} onClick={() => { setSelectedColumn(col); setMainColumn(col); runForecast(col) }} style={{
                        padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                        border: `1px solid ${selectedColumn === col ? 'var(--accent)' : 'var(--border-hover)'}`,
                        background: selectedColumn === col ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                        color: selectedColumn === col ? 'var(--accent-light)' : 'var(--text-secondary)',
                        fontWeight: selectedColumn === col ? 600 : 400
                      }}>{col}</button>
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{dashData.row_count} pts</span>
                  </div>
                )}

                <DataPreview preview={dashData.preview} rowCount={dashData.row_count} />
                <ConfidenceMeter confidence={dashData.confidence} />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                  <MetricCard label="Model" value={dashData.model_used?.split(' ')[0]} sub={dashData.model_used} accent="purple" />
                  <MetricCard label="Latest Value" value={lastActual?.toLocaleString()} sub="Most recent" accent="blue" />
                  <MetricCard label="Week 1 Forecast" value={firstForecast?.toLocaleString()} sub={dashData.forecast?.[0]?.date_label || ''} accent="blue" />
                  <MetricCard label={`Growth W${periods}`} value={`${overallGrowth >= 0 ? '+' : ''}${overallGrowth}%`} sub="vs current" accent={overallGrowth >= 0 ? 'green' : 'red'} />
                  <MetricCard label="Anomalies" value={dashData.anomalies?.length} sub="On chart" accent={dashData.anomalies?.length > 0 ? 'orange' : 'green'} />
                  {dashData.seasonality_period && <MetricCard label="Seasonality" value={dashData.seasonality_period === 7 ? 'Weekly' : 'Monthly'} sub="Detected" accent="purple" />}
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {liveChart ? `${liveChart.metric} — live from chat` : 'Forecast Chart'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([l, c]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DashForecastChart
                    historical={liveChart?.historical || dashData.historical}
                    forecast={liveChart?.forecast?.length ? liveChart.forecast : dashData.forecast}
                    anomalies={liveChart?.anomalies || dashData.anomalies}
                  />
                </div>

                {/* Anomaly list */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Anomaly Detection</div>
                  {dashData.anomalies?.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 13, color: 'var(--green)' }}>
                      ✓ No anomalies — data looks clean
                    </div>
                  ) : (
                    dashData.anomalies.map((a, i) => (
                      <div key={i} style={{ marginBottom: 8, padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>
                          {a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · {a.date || `Point ${a.index}`}
                        </div>
                        <div style={{ fontSize: 12, color: '#fca5a5' }}>
                          <strong>{a.value?.toLocaleString()}</strong> · {Math.abs(a.pct_from_mean)}% from mean · Z={a.z_score}
                        </div>
                        <div style={{ fontSize: 11, color: '#f87171', marginTop: 4, padding: '4px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>{a.next_step}</div>
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

          {/* Chat Header */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-light)' }}>AI</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Forecasting Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {mode === 'insights' ? `${insightsData?.categories?.length || 0} categories · ${insightsData?.regions?.length || 0} regions`
                  : dashData ? `Forecasting: ${selectedColumn}` : 'Waiting for data...'}
              </div>
            </div>
            {(dashData || insightsData) && (
              <div style={{ marginLeft: 'auto', fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 600 }}>● LIVE</div>
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

          {/* Input */}
          <div style={{ padding: '10px 20px 18px', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border-hover)',
                  background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210
                }}
                  onMouseEnter={e => { e.target.style.color = 'var(--text-primary)'; e.target.style.borderColor = 'var(--accent)' }}
                  onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.borderColor = 'var(--border-hover)' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-hover)', padding: '8px 8px 8px 14px' }}>
              <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                placeholder={mode === 'insights' ? 'Ask about revenue, categories, regions, what-if...' : dashData ? `Ask about ${selectedColumn || 'your data'}...` : 'Upload a CSV to get started...'}
                rows={1} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', resize: 'none', lineHeight: 1.5, paddingTop: 3 }} />
              <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()}
                style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: input.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s', flexShrink: 0, fontWeight: 600 }}>
                Send
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}>
              Enter to send · Shift+Enter for new line · Charts update dashboard live
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
