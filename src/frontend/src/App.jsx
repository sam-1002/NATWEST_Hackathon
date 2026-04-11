import { useState } from 'react'
import axios from 'axios'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
  Area, AreaChart
} from 'recharts'

const API = 'http://127.0.0.1:8000'

export default function App() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [scenarioData, setScenarioData] = useState(null)
  const [adjustment, setAdjustment] = useState(10)
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [periods, setPeriods] = useState(4)
  const [question, setQuestion] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [selectedColumn, setSelectedColumn] = useState('value')
  const [error, setError] = useState(null)

const handleUpload = async (col = selectedColumn) => {
    if (!file) return setError('Please select a CSV file first')
    if (!file.name.endsWith('.csv')) return setError('Only CSV files are supported. Please upload a .csv file.')
    setLoading(true)
    setData(null)
    setScenarioData(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(`${API}/forecast?periods=${periods}&column=${col}`, form)
      setData(res.data)
      setSelectedColumn(res.data.selected_column)
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

const handleColumnChange = (col) => {
    setSelectedColumn(col)
    handleUpload(col)
  }

  const handleScenario = async () => {
    if (!file) return
    setScenarioLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await axios.post(
        `${API}/scenario?adjustment_pct=${adjustment}&periods=${periods}`, form
      )
      setScenarioData(res.data)
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message))
    }
    setScenarioLoading(false)
  }
  const handleChat = async () => {
    if (!file) return setError('Please select a CSV file first')
    if (!question.trim()) return setError('Please type a question first')
    setChatLoading(true)
    setData(null)
    setScenarioData(null)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('question', question)
      const res = await axios.post(`${API}/chat`, form)
      setData(res.data)
      setSelectedColumn(res.data.selected_column)
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong.')
    }
    setChatLoading(false)
  }

  const buildChartData = () => {
    if (!data) return []
    const historical = data.historical.map(h => ({
      date: h.date,
      actual: h.value,
      type: 'historical'
    }))
    const lastDate = data.historical[data.historical.length - 1].date
    const forecast = data.forecast.map((f, i) => ({
      date: `Week +${f.period}`,
      likely: f.likely,
      low: f.low,
      high: f.high,
      growth: f.growth_pct
    }))
    return [...historical, ...forecast]
  }

  const chartData = buildChartData()
  const lastActual = data?.historical[data.historical.length - 1]?.value
  const firstForecast = data?.forecast[0]?.likely
  const overallGrowth = data?.forecast[data?.forecast.length - 1]?.growth_pct

  return (
    <div className="app">

      {/* Header */}
      <div className="header">
        <h1>AI Predictive Forecasting</h1>
        <p>Upload your historical data and get AI-powered forecasts, anomaly detection, and scenario analysis</p>
      </div>

      {/* Upload Section */}
<div className="upload-section">
  <h2>Upload Your Data</h2>
  <p>CSV file with a <strong>date</strong> column and one or more numeric columns</p>
  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
    <input
      type="file"
      accept=".csv"
      onChange={e => { setFile(e.target.files[0]); setError(null); }}
      style={{ fontSize: 14 }}
    />
    <select
      value={periods}
      onChange={e => setPeriods(Number(e.target.value))}
      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e0', fontSize: 14 }}
    >
      {[1,2,3,4,5,6].map(n => (
        <option key={n} value={n}>Forecast {n} week{n > 1 ? 's' : ''}</option>
      ))}
    </select>
    <button className="upload-btn" onClick={() => handleUpload()} disabled={loading}>
      {loading ? 'Analysing...' : 'Run Forecast'}
    </button>
  </div>
  {file && <p style={{ marginTop: 12, color: '#667eea', fontSize: 13 }}>Selected: {file.name}</p>}

  {/* error message */}
  {error && (
    <div style={{
      marginTop: 16,
      background: '#fff5f5',
      border: '1px solid #fed7d7',
      borderRadius: 8,
      padding: '12px 16px',
      color: '#c53030',
      fontSize: 14
    }}>
      ❌ {error}
    </div>
  )}
</div>

{/* column selector - shows after first upload */}
{data && data.numeric_columns && data.numeric_columns.length > 1 && (
  <div style={{
    background: 'white',
    borderRadius: 12,
    padding: '16px 24px',
    marginBottom: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    alignItems: 'center',
    gap: 16
  }}>
    <span style={{ fontSize: 14, fontWeight: 600, color: '#2d3748' }}>
      Forecasting column:
    </span>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {data.numeric_columns.map(col => (
        <button
          key={col}
          onClick={() => handleColumnChange(col)}
          style={{
            padding: '6px 16px',
            borderRadius: 20,
            border: '1px solid',
            borderColor: selectedColumn === col ? '#667eea' : '#cbd5e0',
            background: selectedColumn === col ? '#667eea' : 'white',
            color: selectedColumn === col ? 'white' : '#4a5568',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: selectedColumn === col ? 600 : 400
          }}
        >
          {col}
        </button>
      ))}
    </div>
    <span style={{ fontSize: 12, color: '#718096' }}>
      {data.row_count} data points
    </span>
  </div>
)}
{/* Chat Section */}
<div style={{
  background: 'white',
  borderRadius: 16,
  padding: 24,
  marginBottom: 24,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
}}>
  <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#2d3748' }}>
    Ask a Question
  </h2>
  <p style={{ color: '#718096', fontSize: 14, marginBottom: 16 }}>
    Upload your CSV above then ask a question about your data
  </p>
  <div style={{ display: 'flex', gap: 12 }}>
    <input
      type="text"
      value={question}
      onChange={e => setQuestion(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && handleChat()}
      placeholder="e.g. What will sales look like next 4 weeks? Are there any anomalies in traffic?"
      style={{
        flex: 1,
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid #cbd5e0',
        fontSize: 14,
        outline: 'none'
      }}
    />
    <button
      className="upload-btn"
      onClick={handleChat}
      disabled={chatLoading}
      style={{ whiteSpace: 'nowrap' }}
    >
      {chatLoading ? 'Thinking...' : 'Ask ↗'}
    </button>
  </div>

  {/* example questions */}
  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {[
      'What will sales look like next 4 weeks?',
      'Are there any anomalies in traffic?',
      'What will customer numbers be next 6 weeks?',
    ].map(q => (
      <button
        key={q}
        onClick={() => { setQuestion(q); }}
        style={{
          padding: '4px 12px',
          borderRadius: 20,
          border: '1px solid #cbd5e0',
          background: '#f7fafc',
          color: '#4a5568',
          fontSize: 12,
          cursor: 'pointer'
        }}
      >
        {q}
      </button>
    ))}
  </div>

  {/* show what AI understood */}
  {data?.understood_as && (
    <div style={{
      marginTop: 12,
      padding: '8px 14px',
      background: '#ebf4ff',
      borderRadius: 8,
      fontSize: 13,
      color: '#3182ce'
    }}>
      ✓ Understood as: <strong>{data.understood_as}</strong>
    </div>
  )}
</div>

      {/* Loading */}
      {loading && <div className="loading">Running forecast models...</div>}

      {/* Results */}
      {data && (
        <>
          {/* Metric Cards */}
          <div className="cards-grid">
            <div className="metric-card">
              <label>Model Used</label>
              <h3 style={{ fontSize: 16, marginTop: 6 }}>{data.model_used}</h3>
              <span>Auto-selected best model</span>
            </div>
            <div className="metric-card green">
              <label>Latest Value</label>
              <h3>{lastActual?.toLocaleString()}</h3>
              <span>Most recent data point</span>
            </div>
            <div className="metric-card">
              <label>Week 1 Forecast</label>
              <h3>{firstForecast?.toLocaleString()}</h3>
              <span>Central estimate</span>
            </div>
            <div className={`metric-card ${overallGrowth >= 0 ? 'green' : 'red'}`}>
              <label>Growth by Week {periods}</label>
              <h3>{overallGrowth > 0 ? '+' : ''}{overallGrowth}%</h3>
              <span>vs current value</span>
            </div>
            <div className="metric-card orange">
              <label>Anomalies Found</label>
              <h3>{data.anomalies.length}</h3>
              <span>Unusual data points</span>
            </div>
            {data.seasonality_period && (
              <div className="metric-card">
                <label>Seasonality</label>
                <h3>{data.seasonality_period === 7 ? 'Weekly' : 'Monthly'}</h3>
                <span>Pattern detected</span>
              </div>
            )}
          </div>

          {/* AI Summary */}
          <div className="ai-summary">
            <h2>AI Summary</h2>
            <p>{data.ai_summary}</p>
          </div>

          {/* Forecast Chart */}
          <div className="chart-section">
            <h2>
              Forecast Chart
              <span className="model-badge">{data.model_used}</span>
            </h2>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd"/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip formatter={(val) => val?.toLocaleString()}/>
                <Legend/>
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#667eea"
                  fill="url(#colorActual)"
                  strokeWidth={2}
                  name="Historical"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="likely"
                  stroke="#48bb78"
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  name="Forecast (likely)"
                  dot={{ r: 4 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="high"
                  stroke="#ed8936"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Upper bound"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="low"
                  stroke="#fc8181"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="Lower bound"
                  dot={false}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Anomalies */}
          <div className="anomaly-section">
            <h2>Anomaly Detection</h2>
            {data.anomalies.length === 0 ? (
              <p className="no-anomaly">✓ No anomalies detected in your data</p>
            ) : (
              data.anomalies.map((a, i) => (
                <div className="anomaly-item" key={i}>
                  <div className="direction">{a.direction} detected</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>
                    Data point {a.index} — Value: <strong>{a.value}</strong> —
                    Z-score: <strong>{a.z_score}</strong> —
                    <span style={{ color: a.direction === 'spike' ? '#e53e3e' : '#3182ce' }}>
                      {' '}{Math.abs(a.pct_from_mean)}% {a.direction === 'spike' ? 'above' : 'below'} average
                    </span>
                  </div>
                  <div className="next-step">{a.next_step}</div>
                </div>
              ))
            )}
          </div>

          {/* Scenario Builder */}
          <div className="scenario-section">
            <h2>Scenario Builder</h2>
            <p style={{ color: '#718096', fontSize: 14, marginBottom: 16 }}>
              What happens if your values change by a certain percentage?
            </p>
            <div className="slider-row">
              <span style={{ fontSize: 14, color: '#4a5568' }}>Adjustment:</span>
              <input
                type="range"
                min={-50}
                max={50}
                value={adjustment}
                onChange={e => setAdjustment(Number(e.target.value))}
              />
              <span className="slider-label">{adjustment > 0 ? '+' : ''}{adjustment}%</span>
              <button className="run-btn" onClick={handleScenario} disabled={scenarioLoading}>
                {scenarioLoading ? 'Running...' : 'Run Scenario'}
              </button>
            </div>

            {scenarioData && (
              <>
                <div className="ai-summary" style={{ marginBottom: 16 }}>
                  <h2>Scenario Summary</h2>
                  <p>{scenarioData.ai_summary}</p>
                </div>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Week</th>
                      <th>Baseline</th>
                      <th>Scenario ({adjustment > 0 ? '+' : ''}{adjustment}%)</th>
                      <th>Difference</th>
                      <th>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarioData.comparison.map((row, i) => (
                      <tr key={i}>
                        <td>Week {row.period}</td>
                        <td>{row.baseline?.toLocaleString()}</td>
                        <td>{row.scenario?.toLocaleString()}</td>
                        <td className={row.difference >= 0 ? 'positive' : 'negative'}>
                          {row.difference >= 0 ? '+' : ''}{row.difference?.toLocaleString()}
                        </td>
                        <td className={row.difference_pct >= 0 ? 'positive' : 'negative'}>
                          {row.difference_pct >= 0 ? '+' : ''}{row.difference_pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}