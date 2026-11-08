import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty } from '../components/ui.jsx';
import '../styles/dashboard.css';
export default function Dashboard() {
  const { money } = useAuth();
  const [range, setRange] = useState('7d'); const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setD(null); api.get('/dashboard/summary', { params: { range } }).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, [range]);
  const stats = d && [['Net sales', money(d.netSales), 'Excl. tax, after refunds'], ['Gross revenue', money(d.grossRevenue), `${d.paidOrders} paid orders`], ['Avg order value', money(d.avgOrderValue)], ['Refunds', money(d.refunds)], ['Tax collected', money(d.tax)], ['Table occupancy', `${d.occupancy.occupied}/${d.occupancy.total}`]];
  return (
    <div className="page dashboard-page">
      <div className="page-head"><h1 className="serif">Overview</h1>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></div>
      <Alert error={err} />
      {!d && !err && <Empty title="Loading…" />}
      {d && <>
        <div className="dashboard-stats">{stats.map(([l, v, h]) => <div className="card stat-card" key={l}><span className="muted">{l}</span><strong className="num">{v}</strong>{h && <small className="muted">{h}</small>}</div>)}</div>
        <div className="dashboard-grid">
          <section className="card"><h3>Sales trend</h3>
            {d.sales.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.sales}><CartesianGrid stroke="#E2E5DF" vertical={false} /><XAxis dataKey="date" tickFormatter={(x) => x.slice(5)} /><YAxis width={56} /><Tooltip formatter={(v) => money(v)} /><Line dataKey="total" stroke="#183D32" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <Empty title="No sales in this range" />}</section>
          <section className="card"><h3>Best sellers</h3>{d.topItems.length ? <ol className="plain-list">{d.topItems.map((i) => <li key={i.name}><span>{i.name}</span><strong className="num">{i.qty}</strong></li>)}</ol> : <Empty title="No data" />}</section>
          <section className="card"><h3>Low stock</h3>{d.lowStock.length ? <ul className="plain-list">{d.lowStock.map((i) => <li key={i._id}><span>{i.name}</span><strong className="num">{i.quantity} {i.unit}</strong></li>)}</ul> : <Empty title="All stocked" />}</section>
          <section className="card"><h3>Order status</h3><ul className="plain-list">{Object.entries(d.statusSummary).map(([k, v]) => <li key={k}><span className="capitalize">{k}</span><strong className="num">{v}</strong></li>)}</ul></section>
        </div></>}
    </div>
  );
}
