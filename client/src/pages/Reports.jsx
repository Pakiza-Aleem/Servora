import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty } from '../components/ui.jsx';
import '../styles/reports.css';
const Chart = ({ data, x, children }) => (data.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={data}><CartesianGrid stroke="#E2E5DF" vertical={false} /><XAxis dataKey={x} /><YAxis width={56} /><Tooltip />{children}</BarChart></ResponsiveContainer></div> : <Empty title="No data for this range" />);
export default function Reports() {
  const { money } = useAuth();
  const [range, setRange] = useState('7d'); const [custom, setCustom] = useState({ from: '', to: '' }); const [d, setD] = useState(null); const [err, setErr] = useState('');
  const params = range === 'custom' ? { from: custom.from, to: custom.to ? custom.to + 'T23:59:59' : '' } : { range };
  const load = () => { setD(null); api.get('/reports/summary', { params }).then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); };
  useEffect(() => { if (range !== 'custom') load(); }, [range]); // eslint-disable-line
  const exportCsv = async (report) => {
    const r = await api.get('/reports/export', { params: { ...params, report }, responseType: 'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(r.data); a.download = `${report}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  const Bar1 = <Bar dataKey="total" fill="#183D32" radius={[3, 3, 0, 0]} />;
  return (
    <div className="page reports-page"><div className="page-head"><h1 className="serif">Reports</h1>
      <div className="inline"><select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Range"><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="custom">Custom</option></select>
        {range === 'custom' && <><input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="From" /><input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="To" /><button className="btn" onClick={load} disabled={!custom.from}>Apply</button></>}</div></div>
      <Alert error={err} />{!d && !err && <Empty title="Loading…" />}
      {d && <>
        <div className="dashboard-stats">{[['Gross revenue', money(d.revenue)], ['Orders', d.orders], ['Avg order value', money(d.avgOrderValue)], ['Refunds', money(d.refunds)], ['Est. gross profit', money(d.estGrossProfit), `On ${Math.round(d.profitCoverage * 100)}% of sales with cost data`]].map(([l, v, h]) => <div className="card stat-card" key={l}><span className="muted">{l}</span><strong className="num">{v}</strong>{h && <small className="muted">{h}</small>}</div>)}</div>
        <div className="reports-grid">
          <section className="card"><div className="card-head"><h3>Sales over time</h3><button className="btn btn--ghost" onClick={() => exportCsv('sales')}><Download size={16} />CSV</button></div>
            {d.sales.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={d.sales}><CartesianGrid stroke="#E2E5DF" vertical={false} /><XAxis dataKey="date" tickFormatter={(x) => x.slice(5)} /><YAxis width={56} /><Tooltip formatter={(v) => money(v)} /><Line dataKey="total" stroke="#183D32" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div> : <Empty title="No data for this range" />}</section>
          <section className="card"><h3>Revenue by order type</h3><Chart data={d.byType} x="type">{Bar1}</Chart></section>
          <section className="card"><div className="card-head"><h3>Category performance</h3><button className="btn btn--ghost" onClick={() => exportCsv('categories')}><Download size={16} />CSV</button></div><Chart data={d.categories} x="category">{Bar1}</Chart></section>
          <section className="card"><h3>Peak sales hours</h3><Chart data={d.peakHours} x="hour"><Bar dataKey="orders" fill="#B59A68" radius={[3, 3, 0, 0]} /></Chart></section>
          <section className="card"><div className="card-head"><h3>Payment methods</h3><button className="btn btn--ghost" onClick={() => exportCsv('payments')}><Download size={16} />CSV</button></div>{d.payments.length ? <ul className="plain-list">{d.payments.map((p) => <li key={p.method}><span className="capitalize">{p.method}</span><strong className="num">{money(p.total)}</strong></li>)}</ul> : <Empty title="No payments" />}</section>
          <section className="card"><div className="card-head"><h3>Best-selling items</h3><button className="btn btn--ghost" onClick={() => exportCsv('items')}><Download size={16} />CSV</button></div>{d.items.length ? <ol className="plain-list">{d.items.slice(0, 8).map((i) => <li key={i.name}><span>{i.name}</span><strong className="num">{i.qty} · {money(i.revenue)}</strong></li>)}</ol> : <Empty title="No data" />}</section>
          <section className="card"><div className="card-head"><h3>Ingredient usage</h3><button className="btn btn--ghost" onClick={() => exportCsv('ingredients')}><Download size={16} />CSV</button></div>{d.ingredientUsage.length ? <ul className="plain-list">{d.ingredientUsage.map((i) => <li key={i.name}><span>{i.name}</span><strong className="num">{i.qty} {i.unit}</strong></li>)}</ul> : <Empty title="No usage" />}</section>
        </div></>}
    </div>
  );
}
