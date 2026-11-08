import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errMsg, connectSocket } from '../api.js';
import { Alert, Badge, minutesSince } from '../components/ui.jsx';
import { useAuth } from '../auth.jsx';
import '../styles/tables.css';
export default function Tables() {
  const nav = useNavigate(); const { money } = useAuth();
  const [tables, setTables] = useState([]); const [sel, setSel] = useState(null); const [err, setErr] = useState('');
  const load = () => api.get('/tables').then((r) => setTables(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); const s = connectSocket(); s.on('order:update', load); return () => s.close(); }, []);
  const selected = tables.find((t) => t._id === sel);
  const setStatus = async (status) => { try { await api.patch(`/tables/${sel}`, { status }); load(); } catch (e) { setErr(errMsg(e)); } };
  const act = async (url, body) => { try { await api.post(url, body); load(); } catch (e) { setErr(errMsg(e)); } };
  const transfer = async (to) => { try { await api.post(`/tables/${sel}/transfer`, { toTable: to }); setSel(null); load(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div className="page tables-page">
      <div className="page-head"><h1 className="serif">Tables</h1></div><Alert error={err} />
      <div className="floor">{tables.map((t) => (
        <button key={t._id} className={`table-tile table-tile--${t.status} ${sel === t._id ? 'table-tile--sel' : ''}`} onClick={() => setSel(t._id)}>
          <strong>T{t.number}{t.combinedWith?.length ? ' +' + t.combinedWith.length : ''}</strong><span className="muted">{t.seats} seats</span><Badge status={t.status} />
          {t.order && <span className="num small">#{t.order.number} · {minutesSince(t.order.createdAt)} min · {money(t.order.total)}</span>}
        </button>))}</div>
      {selected && <div className="card table-actions"><h3>Table {selected.number}</h3>
        <div className="inline">
          {selected.status === 'available' && <button className="btn" onClick={() => nav(`/pos?table=${selected._id}`)}>Start order</button>}
          {selected.status === 'occupied' && <button className="btn btn--ghost" onClick={() => setStatus('bill_requested')}>Bill requested</button>}
          {selected.status === 'available' && <button className="btn btn--ghost" onClick={() => setStatus('reserved')}>Reserve</button>}
          {selected.status === 'reserved' && <button className="btn btn--ghost" onClick={() => setStatus('available')}>Release</button>}
          {['available', 'occupied'].includes(selected.status) && <select defaultValue="" onChange={(e) => e.target.value && act(`/tables/${sel}/combine`, { withTable: e.target.value })} aria-label="Combine with"><option value="">Combine with…</option>{tables.filter((t) => t.status === 'available' && t._id !== sel).map((t) => <option key={t._id} value={t._id}>Table {t.number}</option>)}</select>}
          {selected.order && <select defaultValue="" onChange={(e) => e.target.value && transfer(e.target.value)} aria-label="Transfer to"><option value="">Transfer order to…</option>{tables.filter((t) => t.status === 'available').map((t) => <option key={t._id} value={t._id}>Table {t.number}</option>)}</select>}
        </div><p className="muted small">Tables close automatically when their order is completed (Orders page).</p></div>}
    </div>
  );
}
