import { useState, useRef, useEffect, useCallback } from 'react'
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

// ─── Theme Context ─────────────────────────────────────────────────────────────
const DARK_VARS = `
  --bg-root: #080810; --bg-primary: #0b0b18; --bg-secondary: #0f0f1e;
  --bg-card: #13131f; --bg-hover: #1a1a2c;
  --border: rgba(255,255,255,0.07); --border-hover: rgba(255,255,255,0.13);
  --text-primary: #eaeaf4; --text-secondary: #8888a8; --text-tertiary: #52526a;
  --accent: #4f8ef7; --accent-light: #93bbff; --accent-bg: rgba(79,142,247,0.1);
  --green: #34d399; --green-bg: rgba(52,211,153,0.08);
  --red: #f87171; --red-bg: rgba(248,113,113,0.08); --orange: #fb923c;
  --shadow: rgba(0,0,0,0.4); --overlay: rgba(0,0,0,0.6);
`
const LIGHT_VARS = `
  --bg-root: #f0f2f8; --bg-primary: #f5f7fc; --bg-secondary: #eaecf5;
  --bg-card: #ffffff; --bg-hover: #e2e5f0;
  --border: rgba(0,0,0,0.08); --border-hover: rgba(0,0,0,0.15);
  --text-primary: #12131a; --text-secondary: #5a5a7a; --text-tertiary: #9898b8;
  --accent: #3b7ef0; --accent-light: #2060d0; --accent-bg: rgba(59,126,240,0.08);
  --green: #0da76f; --green-bg: rgba(13,167,111,0.07);
  --red: #e04040; --red-bg: rgba(224,64,64,0.07); --orange: #e07820;
  --shadow: rgba(0,0,0,0.12); --overlay: rgba(0,0,0,0.3);
`

// ─── Onboarding Guide ─────────────────────────────────────────────────────────
function OnboardingGuide({ onClose, darkMode }) {
  const [step, setStep] = useState(0)
  const steps = [
    {
      icon: '👋',
      title: 'Welcome to Forecast Dashboard',
      desc: 'Your AI-powered analytics assistant. Let\'s walk you through the key features in just 4 quick steps.',
      tip: null
    },
    {
      icon: '📂',
      title: 'Upload Your CSV',
      desc: 'Drag & drop a CSV file onto the dashboard, or click the "Upload CSV" button. Your file needs a date column and at least one numeric metric.',
      tip: 'Tip: Columns like revenue, sales, profit, customers work great!'
    },
    {
      icon: '📊',
      title: 'Explore Your Dashboard',
      desc: 'Once uploaded, you\'ll see metric cards, forecasts, and anomaly detection. The CSV preview lets you browse your full dataset without leaving the page.',
      tip: 'Drag the divider between panels to resize them!'
    },
    {
      icon: '🤖',
      title: 'Chat With Your Data',
      desc: 'Ask natural language questions in the chat panel. Try "What will revenue look like next 4 weeks?" or "Which region has the most unusual activity?"',
      tip: 'Use the quick suggestion chips below the chat input to get started fast!'
    },
    {
      icon: '🎉',
      title: 'You\'re All Set!',
      desc: 'Upload your first CSV to begin. All your data stays on your server — only aggregated stats are sent to the AI.',
      tip: null
    }
  ]
  const current = steps[step]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'var(--overlay)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
        borderRadius: 20, padding: '36px 40px', maxWidth: 440, width: '90%',
        boxShadow: '0 24px 64px var(--shadow)', textAlign: 'center',
        animation: 'slideUp 0.25s ease'
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{current.icon}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '-0.3px' }}>{current.title}</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: current.tip ? 16 : 28 }}>{current.desc}</p>
        {current.tip && (
          <div style={{ background: 'var(--accent-bg)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 28, fontSize: 12, color: 'var(--accent-light)', textAlign: 'left' }}>
            💡 {current.tip}
          </div>
        )}

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 3, background: i === step ? 'var(--accent)' : 'var(--border-hover)', transition: 'all 0.3s' }} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Back</button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Next →</button>
          ) : (
            <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Get Started 🚀</button>
          )}
        </div>
        <button onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer' }}>Skip tour</button>
      </div>
    </div>
  )
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

// ─── Metric Card with ⓘ tooltip ───────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, icon, infoText }) {
  const [showInfo, setShowInfo] = useState(false)
  const colors = { blue: '#4f8ef7', green: '#34d399', orange: '#fb923c', red: '#f87171', purple: '#a78bfa' }
  const c = colors[accent] || colors.blue
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '16px 18px', position: 'relative', overflow: 'visible',
      transition: 'border-color 0.2s', cursor: 'default'
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: c, borderRadius: '3px 0 0 3px' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(ellipse at 0% 50%, ${c}10 0%, transparent 60%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>{label}</div>
            {infoText && (
              <div style={{ position: 'relative', marginBottom: 7 }}
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
              >
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `1px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: c, cursor: 'default', opacity: 0.7 }}>i</div>
                {showInfo && (
                  <div style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    width: 200, background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
                    borderRadius: 10, padding: '10px 12px', zIndex: 200,
                    boxShadow: '0 8px 24px var(--shadow)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5
                  }}>
                    {infoText}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>{value ?? '—'}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 20, opacity: 0.6 }}>{icon}</div>}
      </div>
    </div>
  )
}

// ─── Confidence Bar ────────────────────────────────────────────────────────────
function ConfidenceBar({ confidence, dashData }) {
  const [showTip, setShowTip] = useState(false)
  if (!confidence) return null
  const { score, label } = confidence
  const color = score >= 75 ? '#34d399' : score >= 50 ? '#fb923c' : '#f87171'
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
      <div style={{ position: 'relative', flexShrink: 0 }} onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color, cursor: 'default', opacity: showTip ? 1 : 0.55, transition: 'opacity 0.15s' }}>i</div>
        {showTip && (
          <div style={{ position: 'absolute', right: 0, bottom: 24, width: 260, background: 'var(--bg-card)', border: '1px solid var(--border-hover)', borderRadius: 12, padding: '14px 16px', zIndex: 100, boxShadow: '0 8px 32px var(--shadow)', animation: 'fadeIn 0.15s ease' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, letterSpacing: '0.3px' }}>How confidence is calculated</div>
            {breakdown.map(({ label, score: s, max, tip }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s >= max * 0.7 ? '#34d399' : s >= max * 0.4 ? '#fb923c' : '#f87171' }}>{s} / {max}</span>
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border-hover)', borderRadius: 8, padding: '4px 10px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>🔍</span>
          <input value={searchTerm} onChange={e => handleSearch(e.target.value)} placeholder="Search..."
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 11, color: 'var(--text-primary)', width: 120 }} />
          {searchTerm && <button onClick={() => handleSearch('')} style={{ border: 'none', background: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>}
        </div>
      </div>
      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 380 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr style={{ background: 'var(--bg-secondary)' }}>
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
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '7px 10px', color: 'var(--text-tertiary)', fontSize: 10, userSelect: 'none' }}>{globalIdx}</td>
                  {cols.map(c => (
                    <td key={c} style={{ padding: '7px 12px', color: typeof row[c] === 'number' ? 'var(--accent-light)' : 'var(--text-secondary)', fontSize: 12, whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Rows {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['«', 1], ['‹', Math.max(1, currentPage - 1)]].map(([label, pg]) => (
              <button key={label} onClick={() => setCurrentPage(pg)} disabled={currentPage === 1} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: 11 }}>{label}</button>
            ))}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
              const pg = start + i
              return pg <= totalPages ? (
                <button key={pg} onClick={() => setCurrentPage(pg)} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${currentPage === pg ? 'var(--accent)' : 'var(--border)'}`, background: currentPage === pg ? 'var(--accent-bg)' : 'var(--bg-secondary)', color: currentPage === pg ? 'var(--accent-light)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 11, fontWeight: currentPage === pg ? 700 : 400 }}>{pg}</button>
              ) : null
            })}
            {[['›', Math.min(totalPages, currentPage + 1)], ['»', totalPages]].map(([label, pg]) => (
              <button key={label} onClick={() => setCurrentPage(pg)} disabled={currentPage === totalPages} style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: 11 }}>{label}</button>
            ))}
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

// ─── Anomaly List ─────────────────────────────────────────────────────────────
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {severe > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', fontWeight: 600 }}>{severe} Severe</span>}
        {moderate > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.12)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)', fontWeight: 600 }}>{moderate} Moderate</span>}
        {mild > 0 && <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', color: 'var(--text-tertiary)', border: '1px solid var(--border)', fontWeight: 600 }}>{mild} Mild</span>}
      </div>
      {anomalies.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)' }}>{a.direction === 'spike' ? '▲ Spike' : '▼ Dip'} · {a.date || `Point ${a.index}`}</div>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', fontWeight: 600, textTransform: 'uppercase' }}>{a.severity}</span>
          </div>
          <div style={{ fontSize: 12, color: '#fca5a5' }}>Value <strong>{a.value?.toLocaleString()}</strong> · {Math.abs(a.pct_from_mean)}% from mean · Z = {a.z_score}</div>
          <div style={{ fontSize: 11, color: '#f87171', marginTop: 5, padding: '4px 8px', background: 'rgba(248,113,113,0.08)', borderRadius: 6 }}>{a.next_step}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Category Rankings ────────────────────────────────────────────────────────
function CategoryRankings({ rankings, metric, loading }) {
  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
      Loading category rankings for {metric}...
    </div>
  )
  if (!rankings?.length) return null
  const max = rankings[0]?.forecasted_weekly_avg || 1
  const metricLabel = metric || 'revenue'
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📊 Category Rankings · {metricLabel}</div>
      {rankings.map((r, i) => (
        <div key={r.category || r.value} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i === 0 && <span style={{ fontSize: 12 }}>🏆</span>}
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>{r.category || r.value}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: r.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{r.growth_pct >= 0 ? '+' : ''}{r.growth_pct}%</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.forecasted_weekly_avg?.toLocaleString()}/wk</span>
            </div>
          </div>
          <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((r.forecasted_weekly_avg || 0) / max) * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, opacity: i === 0 ? 1 : 0.55, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Region Signals ───────────────────────────────────────────────────────────
function RegionSignals({ signals, metric, loading }) {
  const signalConfig = {
    anomaly_surge: { color: '#f87171', bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.2)', icon: '🚨', label: 'Anomaly + Surge' },
    anomaly_decline: { color: '#f87171', bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.2)', icon: '📉', label: 'Anomaly + Decline' },
    anomaly: { color: '#fb923c', bg: 'rgba(251,146,60,0.05)', border: 'rgba(251,146,60,0.2)', icon: '⚠️', label: 'Anomaly' },
    surge: { color: '#34d399', bg: 'rgba(52,211,153,0.05)', border: 'rgba(52,211,153,0.2)', icon: '🚀', label: 'Surge' },
    decline: { color: '#f87171', bg: 'rgba(248,113,113,0.05)', border: 'rgba(248,113,113,0.2)', icon: '📉', label: 'Decline' },
    stable: { color: '#8888a8', bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.07)', icon: '✓', label: 'Stable' }
  }
  if (loading) return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
      Loading region signals for {metric}...
    </div>
  )
  if (!signals?.length) return null
  const metricLabel = metric || 'revenue'
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🗺️ Region Signals · {metricLabel}</div>
      {signals.map((r) => {
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

// ─── Inline: Rankings Chart ───────────────────────────────────────────────────
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
            <div style={{ fontSize: 13, fontWeight: 700, color: s.growth_pct >= 0 ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>{s.growth_pct >= 0 ? '+' : ''}{s.growth_pct}%</div>
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
        {metric} scenario <span style={{ color: adjustment > 0 ? 'var(--green)' : adjustment < 0 ? 'var(--red)' : 'var(--text-tertiary)', fontWeight: 700 }}>{adjustment === 0 ? ' (flat)' : ` (${adjustment > 0 ? '+' : ''}${adjustment}%)`}</span>
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
              <td style={{ padding: '7px 10px', fontWeight: 700, color: row.difference >= 0 ? 'var(--green)' : 'var(--red)' }}>{row.difference >= 0 ? '+' : ''}{row.difference?.toLocaleString()}</td>
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
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{metric} — best (+20%) vs worst (-20%)</div>
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

// ─── Chat Message with Copy Button ───────────────────────────────────────────
function ChatMessage({ msg }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content || '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
        <div style={{ background: 'var(--bg-card)', padding: '10px 14px', borderRadius: '4px 14px 14px 14px', fontSize: 13, color: 'var(--text-primary)', border: '1px solid var(--border)', lineHeight: 1.75, position: 'relative' }}>
          {msg.content?.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')}
          <button onClick={handleCopy} title="Copy answer" style={{ position: 'absolute', top: 8, right: 8, background: copied ? 'var(--green-bg)' : 'var(--bg-hover)', border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'var(--border-hover)'}`, borderRadius: 6, padding: '2px 7px', fontSize: 10, color: copied ? 'var(--green)' : 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
        {d.filter_label && (
          <div style={{ display: 'inline-block', marginTop: 6, fontSize: 10, color: 'var(--accent)', padding: '2px 10px', background: 'var(--accent-bg)', borderRadius: 20, border: '1px solid rgba(79,142,247,0.2)' }}>Filtered: {d.filter_label}</div>
        )}
        {d.graph_type === 'forecast' && d.historical && d.forecast && (
          <InlineForecastChart historical={d.historical} forecast={d.forecast} anomalies={d.anomalies} metric={d.metric} filterLabel={d.filter_label} />
        )}
        {d.graph_type === 'rankings' && d.rankings && <InlineRankingsChart rankings={d.rankings} dimension={d.dimension} />}
        {d.graph_type === 'anomaly' && d.historical && (
          <>
            <InlineAnomalyChart historical={d.historical} anomalies={d.anomalies} metric={d.metric} filterLabel={d.filter_label} />
            {d.anomalies?.length === 0 && <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--green-bg)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--green)' }}>✓ No anomalies — data looks clean</div>}
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
        {d.graph_type === 'dimension_signals' && d.signals && <InlineDimensionSignals signals={d.signals} dimension={d.dimension} />}
        {d.graph_type === 'scenario' && d.comparison && <InlineScenarioTable comparison={d.comparison} adjustment={d.adjustment_pct} metric={d.metric} />}
        {d.graph_type === 'best_worst' && d.best_forecast && <InlineBestWorstTable bestForecast={d.best_forecast} worstForecast={d.worst_forecast} baselineForecast={d.baseline_forecast} metric={d.metric} />}
        {d.graph_type === 'forecast' && d.confidence && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Confidence:</div>
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.confidence.score}%`, background: d.confidence.score >= 75 ? '#34d399' : d.confidence.score >= 50 ? '#fb923c' : '#f87171', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: d.confidence.score >= 75 ? 'var(--green)' : d.confidence.score >= 50 ? '#fb923c' : 'var(--red)' }}>{d.confidence.score}/100 {d.confidence.label}</div>
          </div>
        )}
        {d.graph_type === 'driver_analysis' && d.drivers?.length > 0 && (
          <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Top drivers of {d.metric}</div>
            {d.drivers.map((dr, i) => (
              <div key={dr.column} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: i === 0 ? 600 : 400 }}>{dr.column}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: dr.direction === 'positive' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: dr.direction === 'positive' ? 'var(--green)' : 'var(--red)', border: `1px solid ${dr.direction === 'positive' ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>{dr.direction}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>r = {dr.correlation > 0 ? '+' : ''}{dr.correlation}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${dr.abs_correlation * 100}%`, background: COLORS[i % COLORS.length], borderRadius: 3, opacity: i === 0 ? 1 : 0.55 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{dr.strength} relationship</div>
              </div>
            ))}
          </div>
        )}
        {d.graph_type === 'impact_simulation' && d.projected_target != null && (
          <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Impact simulation</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {[['Driver', d.driver_metric, 'var(--text-secondary)'], ['Target', d.target_metric, 'var(--text-secondary)'], ['Change applied', `${d.change_pct > 0 ? '+' : ''}${d.change_pct}%`, d.change_pct >= 0 ? 'var(--green)' : 'var(--red)'], ['Projected change', `${d.projected_change_pct > 0 ? '+' : ''}${d.projected_change_pct?.toFixed(1)}%`, d.projected_change_pct >= 0 ? 'var(--green)' : 'var(--red)']].map(([label, val, color]) => (
                <div key={label} style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 10px', background: 'rgba(79,142,247,0.06)', borderRadius: 8, border: '1px solid rgba(79,142,247,0.15)', fontSize: 11, color: 'var(--text-secondary)' }}>
              Correlation: r = {d.correlation > 0 ? '+' : ''}{d.correlation} · Current {d.driver_metric} avg: {d.current_driver_avg?.toLocaleString()} → Projected {d.target_metric}: <strong style={{ color: 'var(--accent-light)' }}>{d.projected_target?.toLocaleString()}</strong>
            </div>
          </div>
        )}
        {d.graph_type === 'lead_indicator' && d.col_a && (
          <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Lead indicator test</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, marginBottom: 10, background: d.is_leading_indicator ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)', border: `1px solid ${d.is_leading_indicator ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              <span style={{ fontSize: 18 }}>{d.is_leading_indicator ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: d.is_leading_indicator ? 'var(--green)' : 'var(--red)' }}>
                  {d.col_a} {d.is_leading_indicator ? 'IS' : 'is NOT'} a leading indicator for {d.col_b}
                </div>
                {d.is_leading_indicator && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Predicts {d.best_lag_weeks} week(s) ahead · {d.strength} {d.direction} (r={d.best_correlation > 0 ? '+' : ''}{d.best_correlation})</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Chat History Panel ───────────────────────────────────────────────────────
function ChatHistoryPanel({ sessions, activeId, onSelect, onNewChat, onClose }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-card)', zIndex: 50, display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Chat History</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <button onClick={onNewChat} style={{ width: '100%', padding: '9px', borderRadius: 10, border: '1px dashed var(--border-hover)', background: 'var(--bg-secondary)', color: 'var(--accent-light)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>+ New Chat</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>
        {sessions.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 20 }}>No previous sessions</div>}
        {sessions.map(s => (
          <div key={s.id} onClick={() => onSelect(s.id)} style={{ padding: '11px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer', background: s.id === activeId ? 'var(--accent-bg)' : 'var(--bg-secondary)', border: `1px solid ${s.id === activeId ? 'rgba(79,142,247,0.25)' : 'var(--border)'}`, transition: 'all 0.15s' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: s.id === activeId ? 'var(--accent-light)' : 'var(--text-primary)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.title || 'Untitled session'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{s.timestamp} · {s.messages.length} messages</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Drag & Drop Upload Area ───────────────────────────────────────────────────
function DropZone({ onFile }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.csv')) onFile({ target: { files: [f] } })
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current.click()}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '65vh', gap: 16, cursor: 'pointer',
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-hover)'}`,
        borderRadius: 20, background: dragging ? 'var(--accent-bg)' : 'transparent',
        transition: 'all 0.2s', margin: '0 8px'
      }}
    >
      <div style={{ fontSize: 56, transition: 'transform 0.2s', transform: dragging ? 'scale(1.15)' : 'scale(1)' }}>
        {dragging ? '📂' : '📊'}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: dragging ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
        {dragging ? 'Drop your CSV here!' : 'Drag & drop your CSV'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>or click to browse files</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
        Needs a <code style={{ background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>date</code> column + numeric metrics
      </div>
      <input ref={fileRef} type="file" accept=".csv" onChange={onFile} style={{ display: 'none' }} />
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ChatApp() {
  const [darkMode, setDarkMode] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem('onboarding_done') } catch { return true }
  })

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
  const [activeTab, setActiveTab] = useState('overview')

  // Metric toggle for insights mode
  const [activeInsightMetric, setActiveInsightMetric] = useState('revenue')
  const [metricData, setMetricData] = useState({})
  const [metricLoading, setMetricLoading] = useState(false)

  // Chat history
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('chat_sessions') || '[]') } catch { return [] }
  })
  const [activeSessionId, setActiveSessionId] = useState(() => Date.now().toString())
  const [showHistory, setShowHistory] = useState(false)

  const [messages, setMessages] = useState([{
    role: 'bot',
    content: "Hi! I'm your forecasting assistant. Upload a CSV to get started — I support forecasting, anomaly detection, and scenario analysis across any metric, category, or region.",
    data: {}
  }])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const fileRef = useRef()
  const bottomRef = useRef()

  // Resizable divider
  const [dashWidth, setDashWidth] = useState(58)
  const draggingRef = useRef(false)
  const containerRef = useRef()

  // Mobile: which panel is shown
  const [mobilePanel, setMobilePanel] = useState('dash')

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  // Save sessions on message change
  useEffect(() => {
    if (messages.length <= 1) return
    const session = {
      id: activeSessionId,
      title: messages.find(m => m.role === 'user')?.content?.slice(0, 40) || 'Session',
      timestamp: new Date().toLocaleString(),
      messages
    }
    setSessions(prev => {
      const others = prev.filter(s => s.id !== activeSessionId)
      const updated = [session, ...others].slice(0, 20)
      try { localStorage.setItem('chat_sessions', JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [messages])

  // Divider drag
  const startDrag = useCallback((e) => {
    draggingRef.current = true
    const onMove = (ev) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.min(80, Math.max(30, ((ev.clientX - rect.left) / rect.width) * 100))
      setDashWidth(pct)
    }
    const onUp = () => { draggingRef.current = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleFile = async (e) => {
    const f = e.target.files[0]; if (!f) return
    setFile(f); setFileName(f.name); setDashData(null); setInsightsData(null); setAllCsvRows(null)
    setMode(null); setLiveChart(null); setDataSchema(null); setActiveTab('overview'); setActiveInsightMetric('revenue'); setMetricData({})

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

  // Switch metric in insights mode — fetches forecast + rankings + region signals for that metric
  const switchInsightMetric = async (metric) => {
    setActiveInsightMetric(metric)
    if (metric === 'revenue') return   // already loaded from /insights

    // Return cached result if we already fetched this metric
    if (metricData[metric]) return

    if (!file) return
    setMetricLoading(true)
    try {
      // 1. Fetch forecast + anomalies via /chat
      const form = new FormData()
      form.append('file', file)
      form.append('question', `Forecast ${metric} next ${periods} weeks`)
      const res = await axios.post(`${API}/chat?column=${metric}`, form)
      const d = res.data
      if (d.forecast && d.historical) {
        const hist   = d.historical
        const fc     = d.forecast
        const latest = hist[hist.length - 1]?.value
        const first  = fc[0]?.likely
        const growth = fc[fc.length - 1]?.growth_pct

        // 2. Fetch category rankings for this metric via /chat
        let categoryRankings = null
        let regionSignals = null
        try {
          const form2 = new FormData()
          form2.append('file', file)
          form2.append('question', `Which category is expected to perform best next ${periods} weeks?`)
          const res2 = await axios.post(`${API}/chat?column=${metric}`, form2)
          if (res2.data.rankings) categoryRankings = res2.data.rankings
        } catch {}

        // 3. Fetch region signals for this metric via /chat
        try {
          const form3 = new FormData()
          form3.append('file', file)
          form3.append('question', `Which region has the most unusual activity?`)
          const res3 = await axios.post(`${API}/chat?column=${metric}`, form3)
          if (res3.data.signals) regionSignals = res3.data.signals
        } catch {}

        setMetricData(prev => ({
          ...prev,
          [metric]: {
            latest, first, growth,
            dateLabel: fc[0]?.date_label || '',
            anomalyCount: d.anomalies?.length || 0,
            anomalySubtext: d.anomalies?.length === 0 ? 'None detected' : `${d.anomalies?.length} flagged`,
            historical: hist,
            forecast: fc,
            anomalies: d.anomalies || [],
            categoryRankings,
            regionSignals,
          }
        }))
      }
    } catch {}
    setMetricLoading(false)
  }

  const sendMessage = async (text) => {
    const msg = text || input.trim(); if (!msg) return
    if (!file) {
      setMessages(prev => [...prev, { role: 'user', content: msg }, { role: 'bot', content: 'Please upload a CSV file first!', data: {} }])
      setInput(''); return
    }
    setMessages(prev => [...prev, { role: 'user', content: msg }]); setInput(''); setChatLoading(true)
    // On mobile, switch to chat view
    setMobilePanel('chat')
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
          drivers: d.drivers,
          projected_target: d.projected_target, projected_change_pct: d.projected_change_pct,
          driver_metric: d.driver_metric, target_metric: d.target_metric, change_pct: d.change_pct,
          correlation: d.correlation, current_driver_avg: d.current_driver_avg, current_target_avg: d.current_target_avg,
          is_leading_indicator: d.is_leading_indicator, best_lag_weeks: d.best_lag_weeks,
          best_correlation: d.best_correlation, strength: d.strength, lag_results: d.lag_results,
          col_a: d.col_a, col_b: d.col_b,
          var_used: d.var_used, correlation_context: d.correlation_context,
        }
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: 'Something went wrong. Make sure the backend is running.', data: {} }])
    }
    setChatLoading(false)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  const handleNewChat = () => {
    setActiveSessionId(Date.now().toString())
    setMessages([{ role: 'bot', content: "New session started! Upload a CSV or ask a question.", data: {} }])
    setShowHistory(false)
  }

  const handleSelectSession = (id) => {
    const s = sessions.find(s => s.id === id)
    if (s) { setActiveSessionId(id); setMessages(s.messages) }
    setShowHistory(false)
  }

  const closeOnboarding = () => {
    setShowOnboarding(false)
    try { localStorage.setItem('onboarding_done', '1') } catch {}
  }

  const suggestions = mode === 'insights'
    ? [`What will ${mainColumn} look like next 4 weeks?`, 'Which category performs best?', 'Which region has the most unusual activity?', `What is driving ${mainColumn}?`, `Does marketing_spend predict ${mainColumn} in advance?`, 'Show best case vs worst case']
    : selectedColumn
      ? [`Forecast ${selectedColumn} next 4 weeks`, `Any anomalies in ${selectedColumn}?`, `What is driving ${selectedColumn}?`, `What if ${selectedColumn} grows by 20%?`]
      : ['Forecast next 4 weeks', 'Any anomalies?', 'What is driving revenue?']

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
  const anomalies = dashData?.anomalies || id?.revenue_anomalies || []
  const severeCount = anomalies.filter(a => a.severity === 'severe').length
  const anomalySubtext = anomalies.length === 0 ? 'None detected' : severeCount > 0 ? `${severeCount} severe · ${anomalies.length - severeCount} other` : `${anomalies.length} flagged`

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { ${darkMode ? DARK_VARS : LIGHT_VARS} }
        body { font-family: 'DM Sans', sans-serif; background: var(--bg-root); color: var(--text-primary); -webkit-font-smoothing: antialiased; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(128,128,160,0.25); border-radius: 4px; }
        ::placeholder { color: var(--text-tertiary); }
        textarea, input, button, select { font-family: 'DM Sans', sans-serif; }
        @keyframes pulse { 0%,100%{transform:translateY(0);opacity:.3} 50%{transform:translateY(-5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{opacity:0.4} 50%{opacity:0.7} 100%{opacity:0.4} }
        .divider-handle { cursor: col-resize; width: 6px; background: var(--border); transition: background 0.15s; flex-shrink: 0; }
        .divider-handle:hover { background: var(--accent); }
        /* Mobile */
        @media (max-width: 768px) {
          .desktop-layout { display: none !important; }
          .mobile-layout { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
          .mobile-layout { display: none !important; }
          .desktop-layout { display: flex !important; }
        }
      `}</style>

      {showOnboarding && <OnboardingGuide onClose={closeOnboarding} darkMode={darkMode} />}

      {/* ══ DESKTOP LAYOUT ══════════════════════════════════════════════════ */}
      <div className="desktop-layout" ref={containerRef} style={{ height: '100vh', width: '100vw', background: 'var(--bg-root)', overflow: 'hidden' }}>

        {/* ══ LEFT DASHBOARD ════════════════════════════════════════════════ */}
        <div style={{ width: `${dashWidth}%`, height: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>

          {/* Header */}
          <div style={{ padding: '13px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(16px)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Forecast Dashboard</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>AI Predictive Forecasting</div>
            </div>
            {fileName && (
              <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(79,142,247,0.1)', color: 'var(--accent-light)', border: '1px solid rgba(79,142,247,0.2)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📄 {fileName}</div>
            )}
            {/* Dark/Light toggle */}
            <button onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            {/* Onboarding */}
            <button onClick={() => setShowOnboarding(true)} title="Help & guide"
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</button>
            <button onClick={() => fileRef.current.click()}
              style={{ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.15s', flexShrink: 0 }}
              onMouseEnter={e => { e.target.style.background = 'var(--bg-hover)'; e.target.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.target.style.background = 'var(--bg-secondary)'; e.target.style.color = 'var(--text-secondary)' }}>
              {fileName ? 'Change CSV' : '+ Upload CSV'}
            </button>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px', flex: 1 }}>

            {/* Empty / Drop Zone */}
            {!dashData && !insightsData && !dashLoading && !dashError && (
              <DropZone onFile={handleFile} />
            )}

            {dashLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 8 }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />)}
                <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 8 }}>Running analysis...</span>
              </div>
            )}
            {dashError && <div style={{ padding: '12px 16px', background: 'var(--red-bg)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, color: 'var(--red)', fontSize: 13 }}>❌ {dashError}</div>}

            {/* ── INSIGHTS MODE ──────────────────────────────────────── */}
            {mode === 'insights' && insightsData && !dashLoading && (() => {
              // Derive which metric's data to show in the top cards
              const allMetrics = insightsData.schema?.numeric_cols || ['revenue']
              const isRevenue  = activeInsightMetric === 'revenue'
              const cached     = metricData[activeInsightMetric]

              // Values for top 3 metric cards — revenue comes from insightsData, others from cache
              const shownLatest  = isRevenue ? lastRevActual  : cached?.latest
              const shownFirst   = isRevenue ? firstRevForecast : cached?.first
              const shownGrowth  = isRevenue ? overallRevGrowth : cached?.growth
              const shownDate    = isRevenue ? (id?.revenue_forecast?.[0]?.date_label || '') : (cached?.dateLabel || '')
              const shownAnomalies = isRevenue ? insightsData.revenue_anomalies?.length : (cached?.anomalyCount ?? '—')
              const shownAnomalySub = isRevenue ? anomalySubtext : (cached?.anomalySubtext || '')

              const isCurrency = ['revenue', 'profit', 'sales', 'cost', 'spend', 'income', 'earnings']
                .some(k => activeInsightMetric.toLowerCase().includes(k))
              const fmt = v => v == null ? '—' : isCurrency ? `£${Number(v).toLocaleString()}` : Number(v).toLocaleString()

              return (
                <div style={{ animation: 'fadeIn 0.35s ease' }}>

                  {/* Full CSV Viewer */}
                  <CsvViewer allRows={allCsvRows} rowCount={insightsData.row_count} />
                  <ConfidenceBar confidence={insightsData.confidence} />

                  {/* ── Metric Toggle Bar ── */}
                  {allMetrics.length > 1 && (
                    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Metric:</span>
                      {allMetrics.map(m => (
                        <button key={m} onClick={() => switchInsightMetric(m)} style={{
                          padding: '4px 13px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                          border: `1px solid ${activeInsightMetric === m ? 'var(--accent)' : 'var(--border-hover)'}`,
                          background: activeInsightMetric === m ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                          color: activeInsightMetric === m ? 'var(--accent-light)' : 'var(--text-secondary)',
                          fontWeight: activeInsightMetric === m ? 600 : 400,
                          position: 'relative'
                        }}>
                          {m}
                          {metricLoading && activeInsightMetric === m && (
                            <span style={{ marginLeft: 5, display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite', verticalAlign: 'middle' }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── Top 3 Metric Cards (update with toggle) ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
                    <MetricCard
                      label={`Latest ${activeInsightMetric}`}
                      value={metricLoading && !isRevenue && !cached ? '…' : fmt(shownLatest)}
                      sub="Most recent period" accent="blue" icon="💰"
                      infoText={`Most recent actual value of ${activeInsightMetric} from your data.`} />
                    <MetricCard
                      label="Week 1 Forecast"
                      value={metricLoading && !isRevenue && !cached ? '…' : fmt(shownFirst)}
                      sub={shownDate} accent="blue" icon="📈"
                      infoText={`Predicted ${activeInsightMetric} for the very next period.`} />
                    <MetricCard
                      label={`Growth W${periods}`}
                      value={metricLoading && !isRevenue && !cached ? '…' : shownGrowth == null ? '—' : `${shownGrowth >= 0 ? '+' : ''}${shownGrowth}%`}
                      sub="vs current avg"
                      accent={shownGrowth == null ? 'blue' : shownGrowth >= 0 ? 'green' : 'red'}
                      icon={shownGrowth == null ? '~' : shownGrowth >= 0 ? '▲' : '▼'}
                      infoText={`% change from last actual to final forecast week for ${activeInsightMetric}.`} />
                  </div>

                  {/* ── Bottom 3 cards — always revenue-based context ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                    <MetricCard label="Best Category" value={bestCat?.category || '—'} sub={bestCat ? `£${bestCat.forecasted_weekly_avg?.toLocaleString()}/wk` : ''} accent="purple" icon="🏆"
                      infoText="Category with the highest forecasted weekly revenue." />
                    <MetricCard label="Region to Watch" value={watchRegion?.region || watchRegion?.value || 'All Stable'} sub={watchRegion ? watchRegion.signal_label : 'No alerts'} accent={watchRegion ? 'orange' : 'green'} icon={watchRegion ? '⚠️' : '✓'}
                      infoText="Region showing unusual activity — anomalies, surges, or declines." />
                    <MetricCard
                      label={`${activeInsightMetric} Anomalies`}
                      value={metricLoading && !isRevenue && !cached ? '…' : shownAnomalies}
                      sub={shownAnomalySub}
                      accent={shownAnomalies > 0 ? 'orange' : 'green'} icon="🔍"
                      infoText={`Data points in ${activeInsightMetric} flagged as anomalies (Z-score analysis).`} />
                  </div>

                  <CategoryRankings
                    rankings={isRevenue
                      ? insightsData.category_rankings
                      : (cached?.categoryRankings || insightsData.category_rankings)}
                    metric={activeInsightMetric}
                    loading={metricLoading && !cached}
                  />
                  <RegionSignals
                    signals={isRevenue
                      ? insightsData.region_signals
                      : (cached?.regionSignals || insightsData.region_signals)}
                    metric={activeInsightMetric}
                    loading={metricLoading && !cached}
                  />

                  {/* ── Forecast Chart for selected metric ── */}
                  {(() => {
                    const chartHistorical = isRevenue
                      ? insightsData.revenue_historical
                      : cached?.historical
                    const chartForecast = isRevenue
                      ? insightsData.revenue_forecast
                      : cached?.forecast
                    const chartAnomalies = isRevenue
                      ? insightsData.revenue_anomalies
                      : cached?.anomalies

                    if (!chartHistorical?.length) return null
                    return (
                      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            📈 {activeInsightMetric} — Historical & Forecast
                          </span>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                            {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([l, c]) => (
                              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <DashForecastChart
                          historical={chartHistorical}
                          forecast={chartForecast}
                          anomalies={chartAnomalies || []}
                        />
                      </div>
                    )
                  })()}
                </div>
              )
            })()}

            {/* ── FORECAST MODE ──────────────────────────────────────── */}
            {mode === 'forecast' && dashData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.35s ease' }}>
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

                {/* Metric cards for forecast mode */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
                  <MetricCard label="Latest Value" value={lastActual?.toLocaleString()} sub="Most recent actual" accent="blue" icon="📌"
                    infoText="The last observed value in your uploaded dataset." />
                  <MetricCard label="Next Forecast" value={firstForecast?.toLocaleString()} sub={dashData?.forecast?.[0]?.date_label || ''} accent="green" icon="📈"
                    infoText="Model's predicted value for the very next period." />
                  <MetricCard label={`Growth W${periods}`} value={`${overallGrowth >= 0 ? '+' : ''}${overallGrowth}%`} sub="vs latest" accent={overallGrowth >= 0 ? 'green' : 'red'} icon={overallGrowth >= 0 ? '▲' : '▼'}
                    infoText="Percentage change from your last actual to the final week of the forecast." />
                  <MetricCard label="4-Week Avg" value={Math.round(avgLast4)?.toLocaleString()} sub="Recent average" accent="purple" icon="〜"
                    infoText="Average of the last 4 historical data points." />
                  <MetricCard label="Anomalies" value={anomalies.length} sub={anomalySubtext} accent={anomalies.length > 0 ? 'orange' : 'green'} icon="🔍"
                    infoText="Points flagged via Z-score analysis. Severe = |Z| > 3, Moderate = |Z| > 2.5." />
                  <MetricCard label="Data Points" value={dashData.row_count} sub={`${dashData.numeric_columns?.length || 1} columns`} accent="blue" icon="🗄️"
                    infoText="Total number of rows and numeric columns in your dataset." />
                </div>

                <CsvViewer allRows={allCsvRows} rowCount={dashData.row_count} />
                <ConfidenceBar confidence={dashData.confidence} dashData={dashData} />

                {/* Chart */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>📈 {selectedColumn || 'Forecast'} — Historical & Forecast</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                      {[['Historical', '#4f8ef7'], ['Forecast', '#34d399'], ['Range', '#fb923c']].map(([l, c]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <DashForecastChart historical={liveChart?.metric === selectedColumn ? liveChart.historical : dashData.historical} forecast={liveChart?.metric === selectedColumn ? liveChart.forecast : dashData.forecast} anomalies={liveChart?.metric === selectedColumn ? liveChart.anomalies : dashData.anomalies} />
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
                  {[['overview', 'Overview'], ['anomalies', `Anomalies (${anomalies.length})`]].map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${activeTab === tab ? 'var(--accent)' : 'var(--border-hover)'}`, background: activeTab === tab ? 'var(--accent-bg)' : 'var(--bg-secondary)', color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-secondary)', fontWeight: activeTab === tab ? 600 : 400 }}>{label}</button>
                  ))}
                </div>

                {activeTab === 'anomalies' && <AnomalyList anomalies={dashData.anomalies} />}
              </div>
            )}
          </div>
        </div>

        {/* ══ DIVIDER HANDLE ══════════════════════════════════════════════════ */}
        <div className="divider-handle" onMouseDown={startDrag} title="Drag to resize" />

        {/* ══ RIGHT CHAT ════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', position: 'relative' }}>

          {showHistory && (
            <ChatHistoryPanel
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={handleSelectSession}
              onNewChat={handleNewChat}
              onClose={() => setShowHistory(false)}
            />
          )}

          {/* Chat Header */}
          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: 'var(--bg-primary)', backdropFilter: 'blur(16px)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(167,139,250,0.2))', border: '1px solid rgba(79,142,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Forecasting Assistant</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {mode === 'insights' ? `${insightsData?.categories?.length || 0} categories · ${insightsData?.regions?.length || 0} regions` : dashData ? `Forecasting: ${selectedColumn}` : 'Waiting for data...'}
              </div>
            </div>
            {(dashData || insightsData) && (
              <div style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s ease-in-out infinite' }} /> LIVE
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button onClick={() => setShowHistory(h => !h)} title="Chat history"
                style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border-hover)', background: showHistory ? 'var(--accent-bg)' : 'var(--bg-secondary)', color: showHistory ? 'var(--accent-light)' : 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
                🕑 History
              </button>
            </div>
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
                <button key={s} onClick={() => sendMessage(s)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-tertiary)', transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220, marginBottom: 5 }}
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
                style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: input.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s', flexShrink: 0, fontWeight: 600 }}>
                Send
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 6 }}>Enter to send · Shift+Enter for new line</div>
          </div>
        </div>
      </div>

      {/* ══ MOBILE LAYOUT ═══════════════════════════════════════════════════ */}
      <div className="mobile-layout" style={{ flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-root)' }}>

        {/* Mobile top bar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-primary)', flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Forecast Dashboard</div>
          <button onClick={() => setDarkMode(d => !d)} style={{ width: 30, height: 30, borderRadius: '50%', border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{darkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => fileRef.current.click()} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {fileName ? '📄' : '+ CSV'}
          </button>
        </div>

        {/* Mobile panel content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* Dashboard panel */}
          <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '16px', display: mobilePanel === 'dash' ? 'block' : 'none' }}>
            {!dashData && !insightsData && !dashLoading && <DropZone onFile={handleFile} />}
            {dashLoading && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40, gap: 6 }}>{[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }} />)}</div>}
            {mode === 'insights' && insightsData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <CsvViewer allRows={allCsvRows} rowCount={insightsData.row_count} />
                <ConfidenceBar confidence={insightsData.confidence} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <MetricCard label="Latest Revenue" value={`£${lastRevActual?.toLocaleString()}`} sub="Most recent" accent="blue" icon="💰" infoText="The most recent actual revenue value." />
                  <MetricCard label="W1 Forecast" value={`£${firstRevForecast?.toLocaleString()}`} accent="blue" icon="📈" infoText="Likely revenue for next period." />
                  <MetricCard label="Growth" value={`${overallRevGrowth >= 0 ? '+' : ''}${overallRevGrowth}%`} accent={overallRevGrowth >= 0 ? 'green' : 'red'} icon="▲" infoText="Change from last actual to final forecast." />
                  <MetricCard label="Anomalies" value={insightsData.revenue_anomalies?.length} sub={anomalySubtext} accent={insightsData.revenue_anomalies?.length > 0 ? 'orange' : 'green'} icon="🔍" infoText="Data points flagged via Z-score." />
                </div>
                <CategoryRankings rankings={insightsData.category_rankings} />
                <RegionSignals signals={insightsData.region_signals} />
              </div>
            )}
            {mode === 'forecast' && dashData && !dashLoading && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <CsvViewer allRows={allCsvRows} rowCount={dashData.row_count} />
                <ConfidenceBar confidence={dashData.confidence} dashData={dashData} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <MetricCard label="Latest" value={lastActual?.toLocaleString()} accent="blue" icon="📌" infoText="Last observed value." />
                  <MetricCard label="Next Forecast" value={firstForecast?.toLocaleString()} accent="green" icon="📈" infoText="Model prediction for next period." />
                  <MetricCard label="Growth" value={`${overallGrowth >= 0 ? '+' : ''}${overallGrowth}%`} accent={overallGrowth >= 0 ? 'green' : 'red'} icon="▲" infoText="% change to final forecast week." />
                  <MetricCard label="Anomalies" value={anomalies.length} sub={anomalySubtext} accent={anomalies.length > 0 ? 'orange' : 'green'} icon="🔍" infoText="Z-score flagged data points." />
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px', marginBottom: 14 }}>
                  <DashForecastChart historical={dashData.historical} forecast={dashData.forecast} anomalies={dashData.anomalies} />
                </div>
              </div>
            )}
          </div>

          {/* Chat panel */}
          <div style={{ position: 'absolute', inset: 0, display: mobilePanel === 'chat' ? 'flex' : 'none', flexDirection: 'column', background: 'var(--bg-primary)' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)}
              {chatLoading && <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-bg)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>AI</div><TypingIndicator /></div>}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: '8px 14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 6, marginBottom: 6 }}>
                {suggestions.slice(0, 3).map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, border: '1px solid var(--border-hover)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{s}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-hover)', padding: '7px 8px 7px 12px' }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} placeholder="Ask about your data..." rows={1} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text-primary)', resize: 'none', lineHeight: 1.5 }} />
                <button onClick={() => sendMessage()} disabled={chatLoading || !input.trim()} style={{ background: input.trim() ? 'var(--accent)' : 'var(--bg-hover)', color: input.trim() ? '#fff' : 'var(--text-tertiary)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: input.trim() ? 'pointer' : 'default', fontWeight: 600 }}>Send</button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <div className="mobile-nav" style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexShrink: 0 }}>
          {[['dash', '📊', 'Dashboard'], ['chat', '💬', 'Chat']].map(([panel, icon, label]) => (
            <button key={panel} onClick={() => setMobilePanel(panel)} style={{ flex: 1, padding: '10px', border: 'none', background: mobilePanel === panel ? 'var(--accent-bg)' : 'transparent', color: mobilePanel === panel ? 'var(--accent-light)' : 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontSize: 10, fontWeight: mobilePanel === panel ? 600 : 400 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'var(--bg-primary)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
        padding: '5px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Your data stays on your server · AI only receives aggregated stats, never raw rows</span>
        </div>
        <div style={{ width: 1, height: 12, background: 'var(--border)', flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>AI can make mistakes · Please double-check responses</span>
      </div>
    </>
  )
}