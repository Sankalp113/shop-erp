'use client'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// ── Palette ───────────────────────────────────────────────────────────────────
const P = ['#7C3AED', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1']

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e1b4b', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 10, color: '#e2e8f0', fontSize: 12 },
  cursor: { fill: 'rgba(124,58,237,0.08)' },
}

function INRTick({ x, y, payload }: any) {
  const v = payload.value
  const label = typeof v === 'number' ? (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`) : v
  return <text x={x} y={y} dy={4} textAnchor="end" fill="#6B7280" fontSize={11}>{label}</text>
}

function PctTick({ x, y, payload }: any) {
  return <text x={x} y={y} dy={4} textAnchor="end" fill="#6B7280" fontSize={11}>{payload.value}%</text>
}

function inrTooltip(v: number) { return formatCurrency(v) }
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

// ── SALES charts ─────────────────────────────────────────────────────────────
export function SalesCharts({ data }: { data: any[] }) {
  // Daily trend
  const dailyMap: Record<string, { date: string; revenue: number; profit: number; bills: number }> = {}
  data.forEach(r => {
    const d = (r.saleDate || '').slice(0, 10)
    if (!dailyMap[d]) dailyMap[d] = { date: d, revenue: 0, profit: 0, bills: 0 }
    dailyMap[d].revenue += r.totalAmount || 0
    dailyMap[d].profit += (r.totalAmount || 0) - (r.totalCost || 0)
    dailyMap[d].bills++
  })
  const daily = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({ ...r, date: r.date.slice(8) })) // show day number

  // Payment mode
  const modes: Record<string, number> = {}
  data.forEach(r => { const m = r.paymentMode || 'cash'; modes[m] = (modes[m] || 0) + (r.totalAmount || 0) })
  const pie = Object.entries(modes).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value) }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Daily Sales & Profit Trend">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={daily} margin={{ left: 10, right: 10, top: 5 }}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false}/>
            <YAxis tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#7C3AED" fill="url(#gRev)" strokeWidth={2}/>
            <Area type="monotone" dataKey="profit" name="Profit" stroke="#10B981" fill="url(#gPro)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Payment Mode Breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
              {pie.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
              <LabelList dataKey="name" position="outside" style={{ fill: '#9CA3AF', fontSize: 11 }}/>
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── PURCHASES charts ──────────────────────────────────────────────────────────
export function PurchaseCharts({ data }: { data: any[] }) {
  const vMap: Record<string, { vendor: string; total: number; paid: number; outstanding: number }> = {}
  data.forEach(r => {
    const v = r.vendorName || 'Unknown'
    if (!vMap[v]) vMap[v] = { vendor: v.length > 14 ? v.slice(0, 14) + '…' : v, total: 0, paid: 0, outstanding: 0 }
    vMap[v].total += r.totalAmount || 0
    vMap[v].paid += r.paidAmount || 0
    vMap[v].outstanding += r.outstandingAmount || 0
  })
  const vendors = Object.values(vMap).sort((a, b) => b.total - a.total).slice(0, 8)

  const statusPie = [
    { name: 'Paid', value: data.filter(r => r.status === 'paid').length },
    { name: 'Partial', value: data.filter(r => r.status === 'partial').length },
    { name: 'Unpaid', value: data.filter(r => r.status === 'unpaid').length },
  ].filter(x => x.value > 0)

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Top Vendors — Paid vs Outstanding">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={vendors} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <YAxis type="category" dataKey="vendor" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={90} tickLine={false}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar dataKey="paid" name="Paid" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]}/>
            <Bar dataKey="outstanding" name="Outstanding" stackId="a" fill="#F59E0B" radius={[0, 4, 4, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Payment Status Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={statusPie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
              {statusPie.map((_, i) => <Cell key={i} fill={['#10B981', '#F59E0B', '#EF4444'][i]}/>)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── INVENTORY charts ──────────────────────────────────────────────────────────
export function InventoryCharts({ data }: { data: any[] }) {
  const top = data
    .map(r => ({ name: (r.name || '').slice(0, 16), value: (r.quantity || 0) * (r.purchasePrice || 0), qty: r.quantity || 0 }))
    .sort((a, b) => b.value - a.value).slice(0, 10)

  const catMap: Record<string, number> = {}
  data.forEach(r => { const c = r.category || 'Other'; catMap[c] = (catMap[c] || 0) + (r.quantity || 0) * (r.purchasePrice || 0) })
  const catPie = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value).slice(0, 7)

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Top 10 Products by Stock Value">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} width={100} tickLine={false}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Bar dataKey="value" name="Stock Value" fill="#7C3AED" radius={[0, 4, 4, 0]}>
              {top.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Category-wise Stock Distribution">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={catPie} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#4B5563', strokeWidth: 1 }}>
              {catPie.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── STOCK AGING charts ────────────────────────────────────────────────────────
export function StockAgingCharts({ data }: { data: any[] }) {
  const buckets = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0, 'Never Sold': 0 }
  const bucketVal = { '0-30 Days': 0, '31-60 Days': 0, '61-90 Days': 0, '90+ Days': 0, 'Never Sold': 0 }
  data.forEach(r => {
    const d = r.lastSaleDate ? Math.floor((Date.now() - new Date(r.lastSaleDate).getTime()) / 86400000) : 9999
    const v = (r.quantity || 0) * (r.purchasePrice || 0)
    if (d === 9999) { buckets['Never Sold']++; bucketVal['Never Sold'] += v }
    else if (d <= 30) { buckets['0-30 Days']++; bucketVal['0-30 Days'] += v }
    else if (d <= 60) { buckets['31-60 Days']++; bucketVal['31-60 Days'] += v }
    else if (d <= 90) { buckets['61-90 Days']++; bucketVal['61-90 Days'] += v }
    else { buckets['90+ Days']++; bucketVal['90+ Days'] += v }
  })
  const bar = Object.entries(buckets).map(([name, count], i) => ({ name, count, value: Math.round(bucketVal[name as keyof typeof bucketVal]) }))
  const pie = bar.map(b => ({ name: b.name, value: b.value })).filter(x => x.value > 0)
  const colors = ['#10B981', '#F59E0B', '#F97316', '#EF4444', '#6B7280']

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Stock Aging — Count & Value by Bucket">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={bar} margin={{ left: 10, right: 30, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false}/>
            <YAxis yAxisId="left" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
            <YAxis yAxisId="right" orientation="right" tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => name === 'Stock Value' ? inrTooltip(v) : v}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar yAxisId="left" dataKey="count" name="Product Count" radius={[4, 4, 0, 0]}>
              {bar.map((_, i) => <Cell key={i} fill={colors[i]}/>)}
            </Bar>
            <Line yAxisId="right" type="monotone" dataKey="value" name="Stock Value" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', r: 4 }}/>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Aging — Stock Value Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value">
              {pie.map((_, i) => <Cell key={i} fill={colors[i]}/>)}
              <LabelList dataKey="name" position="outside" style={{ fill: '#9CA3AF', fontSize: 10 }}/>
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── PROFIT MARGIN charts ──────────────────────────────────────────────────────
export function ProfitCharts({ data }: { data: any[] }) {
  const top = data
    .map(r => ({
      name: (r.name || '').slice(0, 14),
      revenue: r.revenue || 0,
      profit: r.grossProfit || 0,
      margin: r.netSales ? Math.round((r.grossProfit || 0) / r.netSales * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const marginBars = [...top].sort((a, b) => b.margin - a.margin)

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Revenue vs Gross Profit (Top 10 Products)">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={top} margin={{ left: 10, right: 40, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} angle={-30} textAnchor="end" height={40}/>
            <YAxis yAxisId="left" tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <YAxis yAxisId="right" orientation="right" tick={<PctTick/>} tickLine={false} axisLine={false} width={40}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any, name: any) => name === 'Margin %' ? `${v}%` : inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#7C3AED" radius={[4, 4, 0, 0]} opacity={0.8}/>
            <Bar yAxisId="left" dataKey="profit" name="Profit" fill="#10B981" radius={[4, 4, 0, 0]}/>
            <Line yAxisId="right" type="monotone" dataKey="margin" name="Margin %" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 4 }}/>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Profit Margin % — Product Ranking">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={marginBars} layout="vertical" margin={{ left: 10, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={<PctTick/>} tickLine={false} axisLine={false} width={40}/>
            <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 10 }} width={100} tickLine={false}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => `${v}%`}/>
            <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
              {marginBars.map((r, i) => <Cell key={i} fill={r.margin > 30 ? '#10B981' : r.margin > 15 ? '#F59E0B' : '#EF4444'}/>)}
              <LabelList dataKey="margin" position="right" style={{ fill: '#9CA3AF', fontSize: 10 }} formatter={(v: any) => `${v}%`}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── EXPENSES charts ───────────────────────────────────────────────────────────
export function ExpenseCharts({ data }: { data: any[] }) {
  const catMap: Record<string, number> = {}
  data.forEach(r => { const c = r.categoryName || 'Misc'; catMap[c] = (catMap[c] || 0) + (r.amount || 0) })
  const pie = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)

  const dailyMap: Record<string, number> = {}
  data.forEach(r => { const d = (r.expenseDate || '').slice(0, 10); dailyMap[d] = (dailyMap[d] || 0) + (r.amount || 0) })
  const trend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date: date.slice(8), amount }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Expense Category Breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value"
              label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={{ stroke: '#4B5563', strokeWidth: 1 }}>
              {pie.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Daily Expense Trend">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ left: 10, right: 10, top: 5 }}>
            <defs>
              <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false}/>
            <YAxis tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Area type="monotone" dataKey="amount" name="Expenses" stroke="#EF4444" fill="url(#gExp)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── CASH BOOK charts ──────────────────────────────────────────────────────────
export function CashBookCharts({ data }: { data: any[] }) {
  const grouped: Record<string, { date: string; cashIn: number; cashOut: number }> = {}
  data.forEach(r => {
    const d = (r.date || '').slice(0, 10)
    if (!grouped[d]) grouped[d] = { date: d.slice(8), cashIn: 0, cashOut: 0 }
    grouped[d].cashIn += r.cashIn || 0
    grouped[d].cashOut += r.cashOut || 0
  })
  const trend = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date))

  const typePie: Record<string, number> = {}
  data.forEach(r => { const t = r.transactionType || 'Other'; typePie[t] = (typePie[t] || 0) + (r.cashIn || r.cashOut || 0) })
  const pie = Object.entries(typePie).map(([name, value]) => ({ name, value: Math.round(value) }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Daily Cash In vs Cash Out">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend} margin={{ left: 10, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false}/>
            <YAxis tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar dataKey="cashIn" name="Cash In" fill="#10B981" radius={[4, 4, 0, 0]}/>
            <Bar dataKey="cashOut" name="Cash Out" fill="#EF4444" radius={[4, 4, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Transaction Type Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value">
              {pie.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── DAILY SUMMARY charts ──────────────────────────────────────────────────────
export function DailySummaryCharts({ data }: { data: any[] }) {
  const sorted = [...data].sort((a, b) => (a.summaryDate || '').localeCompare(b.summaryDate || ''))
    .slice(-30).map(r => ({
      date: (r.summaryDate || '').slice(8),
      sales: r.totalSales || 0,
      purchases: r.purchases || 0,
      expenses: r.expenses || 0,
      profit: r.grossProfit || 0,
    }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 mb-4">
      <ChartCard title="30-Day Business Performance — Sales vs Purchases vs Expenses">
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={sorted} margin={{ left: 10, right: 30, top: 5 }}>
            <defs>
              <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false}/>
            <YAxis tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Area type="monotone" dataKey="sales" name="Sales" stroke="#7C3AED" fill="url(#gSales)" strokeWidth={2}/>
            <Bar dataKey="purchases" name="Purchases" fill="#06B6D4" radius={[2, 2, 0, 0]} opacity={0.7}/>
            <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[2, 2, 0, 0]} opacity={0.7}/>
            <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#10B981" strokeWidth={2} dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── SALARY charts ─────────────────────────────────────────────────────────────
export function SalaryCharts({ data }: { data: any[] }) {
  const emp = data.slice(0, 10).map(r => ({
    name: (r.employeeName || '').slice(0, 14),
    basic: r.basicSalary || 0,
    overtime: r.overtime || 0,
    commission: r.commission || 0,
    deductions: r.deductions || 0,
    net: r.netSalary || 0,
  }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 mb-4">
      <ChartCard title="Salary Components per Employee">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={emp} margin={{ left: 10, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false}/>
            <YAxis tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar dataKey="basic" name="Basic" stackId="a" fill="#7C3AED"/>
            <Bar dataKey="overtime" name="Overtime" stackId="a" fill="#06B6D4"/>
            <Bar dataKey="commission" name="Commission" stackId="a" fill="#10B981"/>
            <Bar dataKey="deductions" name="Deductions" fill="#EF4444" radius={[4, 4, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── ATTENDANCE charts ─────────────────────────────────────────────────────────
export function AttendanceCharts({ data }: { data: any[] }) {
  const statusMap: Record<string, number> = {}
  data.forEach(r => { const s = r.attendanceStatus || 'Present'; statusMap[s] = (statusMap[s] || 0) + 1 })
  const pie = Object.entries(statusMap).map(([name, value]) => ({ name, value }))

  const empMap: Record<string, { name: string; present: number; absent: number; leave: number }> = {}
  data.forEach(r => {
    const e = r.employeeName || 'Unknown'
    if (!empMap[e]) empMap[e] = { name: e.slice(0, 14), present: 0, absent: 0, leave: 0 }
    const s = (r.attendanceStatus || '').toLowerCase()
    if (s === 'present') empMap[e].present++
    else if (s === 'absent') empMap[e].absent++
    else empMap[e].leave++
  })
  const bars = Object.values(empMap).slice(0, 10)

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Attendance Status Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
              {pie.map((_, i) => <Cell key={i} fill={['#10B981', '#EF4444', '#F59E0B', '#6B7280'][i % 4]}/>)}
              <LabelList dataKey="name" position="outside" style={{ fill: '#9CA3AF', fontSize: 11 }}/>
            </Pie>
            <Tooltip {...TOOLTIP_STYLE}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Employee Attendance Summary">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bars} margin={{ left: 5, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} angle={-25} textAnchor="end" height={40}/>
            <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
            <Tooltip {...TOOLTIP_STYLE}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar dataKey="present" name="Present" stackId="a" fill="#10B981"/>
            <Bar dataKey="leave" name="Leave" stackId="a" fill="#F59E0B"/>
            <Bar dataKey="absent" name="Absent" stackId="a" fill="#EF4444" radius={[4, 4, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── VENDOR / CUSTOMER OUTSTANDING charts ──────────────────────────────────────
export function OutstandingCharts({ data, label }: { data: any[]; label: string }) {
  const top = [...data]
    .filter(r => (r.outstanding || 0) > 0)
    .sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0))
    .slice(0, 10)
    .map(r => ({ name: (r.name || '').slice(0, 16), outstanding: r.outstanding || 0 }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 mb-4">
      <ChartCard title={`Top ${label} by Outstanding Amount`}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={top} layout="vertical" margin={{ left: 10, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false}/>
            <XAxis type="number" tick={<INRTick/>} tickLine={false} axisLine={false} width={55}/>
            <YAxis type="category" dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={110} tickLine={false}/>
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => inrTooltip(v)}/>
            <Bar dataKey="outstanding" name="Outstanding" radius={[0, 4, 4, 0]}>
              {top.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
              <LabelList dataKey="outstanding" position="right" style={{ fill: '#9CA3AF', fontSize: 10 }}
                formatter={(v: any) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── REMINDERS charts ──────────────────────────────────────────────────────────
export function ReminderCharts({ data }: { data: any[] }) {
  const typeMap: Record<string, number> = {}
  data.forEach(r => { const t = r.reminderType || 'Other'; typeMap[t] = (typeMap[t] || 0) + 1 })
  const pie = Object.entries(typeMap).map(([name, value]) => ({ name, value }))

  const priority = [
    { name: 'High', value: data.filter(r => (r.priority || '').toLowerCase() === 'high').length },
    { name: 'Medium', value: data.filter(r => (r.priority || '').toLowerCase() === 'medium').length },
    { name: 'Low', value: data.filter(r => (r.priority || '').toLowerCase() === 'low').length },
  ].filter(x => x.value > 0)

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <ChartCard title="Reminder Type Distribution">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={pie} cx="50%" cy="50%" outerRadius={85} paddingAngle={3} dataKey="value"
              label={({ name, value }) => `${name} (${value})`} labelLine={{ stroke: '#4B5563' }}>
              {pie.map((_, i) => <Cell key={i} fill={P[i % P.length]}/>)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Priority Breakdown">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={priority} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
              {priority.map((_, i) => <Cell key={i} fill={['#EF4444', '#F59E0B', '#10B981'][i]}/>)}
              <LabelList dataKey="name" position="outside" style={{ fill: '#9CA3AF', fontSize: 12 }}/>
            </Pie>
            <Tooltip {...TOOLTIP_STYLE}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ── LOW STOCK chart ───────────────────────────────────────────────────────────
export function LowStockCharts({ data }: { data: any[] }) {
  const low = data.filter(r => (r.quantity || 0) <= (r.reorderLevel || 5))
    .slice(0, 12).map(r => ({
      name: (r.name || '').slice(0, 14),
      current: r.quantity || 0,
      reorder: r.reorderLevel || 5,
    }))

  if (!data.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 mb-4">
      <ChartCard title="Current Stock vs Reorder Level (Low Stock Products)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={low} margin={{ left: 5, right: 10, top: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 10 }} tickLine={false} angle={-25} textAnchor="end" height={45}/>
            <YAxis tick={{ fill: '#6B7280', fontSize: 11 }} tickLine={false} axisLine={false}/>
            <Tooltip {...TOOLTIP_STYLE}/>
            <Legend wrapperStyle={{ fontSize: 12, color: '#9CA3AF' }}/>
            <Bar dataKey="reorder" name="Reorder Level" fill="#F59E0B" opacity={0.5} radius={[4, 4, 0, 0]}/>
            <Bar dataKey="current" name="Current Qty" fill="#EF4444" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="current" position="top" style={{ fill: '#EF4444', fontSize: 11, fontWeight: 'bold' }}/>
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
