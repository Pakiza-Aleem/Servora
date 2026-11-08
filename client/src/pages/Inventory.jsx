import { useEffect, useState } from 'react';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Badge } from '../components/ui.jsx';
export default function Inventory() {
  const { money } = useAuth();
  const [items, setItems] = useState([]); const [err, setErr] = useState(''); const [hist, setHist] = useState(null);
  const [m, setM] = useState({ item: '', type: 'receive', qty: '', reason: '' });
  const load = () => api.get('/inventory').then((r) => setItems(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const submit = async (e) => { e.preventDefault(); try { setErr(''); await api.post(`/inventory/${m.item}/stock-movements`, { type: m.type, qty: +m.qty, reason: m.reason }); setM({ ...m, qty: '', reason: '' }); load(); } catch (x) { setErr(errMsg(x)); } };
  const showHist = async (it) => setHist({ it, rows: (await api.get(`/inventory/${it._id}/movements`)).data });
  return (
    <div className="page"><div className="page-head"><h1 className="serif">Inventory</h1></div><Alert error={err} />
      <form className="card form-row" onSubmit={submit}>
        <select required value={m.item} onChange={(e) => setM({ ...m, item: e.target.value })}><option value="">Ingredient…</option>{items.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}</select>
        <select value={m.type} onChange={(e) => setM({ ...m, type: e.target.value })}><option value="receive">Receive stock</option><option value="adjust">Adjust (+/−)</option></select>
        <input required type="number" step="any" placeholder="Quantity" value={m.qty} onChange={(e) => setM({ ...m, qty: e.target.value })} />
        <input required minLength={2} placeholder="Reason" value={m.reason} onChange={(e) => setM({ ...m, reason: e.target.value })} /><button className="btn">Save</button></form>
      <div className="table-wrap"><table className="table"><thead><tr><th>Ingredient</th><th>On hand</th><th>Minimum</th><th>Cost/unit</th><th>Status</th><th></th></tr></thead><tbody>
        {items.map((i) => <tr key={i._id}><td data-label="Ingredient">{i.name}</td><td data-label="On hand" className="num">{+i.quantity.toFixed(2)} {i.unit}</td><td data-label="Minimum" className="num">{i.minStock} {i.unit}</td><td data-label="Cost/unit" className="num">{money(i.costPerUnit)}</td><td data-label="Status"><Badge status={i.quantity <= i.minStock ? 'low' : 'ok'} /></td><td><button className="btn btn--ghost" onClick={() => showHist(i)}>Ledger</button></td></tr>)}
      </tbody></table></div>
      {hist && <div className="modal-wrap"><div className="modal"><h3>{hist.it.name} — stock ledger</h3><ul className="plain-list">{hist.rows.map((r) => <li key={r._id}><span>{new Date(r.createdAt).toLocaleString()} · {r.type} · {r.reason}</span><strong className="num">{r.qty > 0 ? '+' : ''}{+r.qty.toFixed(2)}</strong></li>)}</ul><div className="modal__actions"><button className="btn btn--ghost" onClick={() => setHist(null)}>Close</button></div></div></div>}
    </div>
  );
}
