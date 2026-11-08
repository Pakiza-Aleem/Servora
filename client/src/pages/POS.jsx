import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import { api, errMsg, imgUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import { cartActions as A } from '../app/store.js';
import { Alert, Empty, Receipt } from '../components/ui.jsx';
import '../styles/pos.css';
const newKey = () => crypto.randomUUID();
export default function POS() {
  const { money, restaurant, user } = useAuth();
  const dispatch = useDispatch(); const cart = useSelector((s) => s.cart); const [params] = useSearchParams();
  const [menu, setMenu] = useState({ items: [], categories: [] }); const [tables, setTables] = useState([]); const [customers, setCustomers] = useState([]);
  const [cat, setCat] = useState('all'); const [q, setQ] = useState(''); const [picking, setPicking] = useState(null); const [sel, setSel] = useState({});
  const [method, setMethod] = useState('cash'); const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(null);
  const key = useRef(newKey()); // one idempotency key per cart: double-clicks/retries never create two orders
  useEffect(() => {
    api.get('/menu').then((r) => setMenu(r.data)); api.get('/tables').then((r) => setTables(r.data)); api.get('/customers').then((r) => setCustomers(r.data));
    if (params.get('table')) dispatch(A.setField({ k: 'table', v: params.get('table') }));
  }, [params, dispatch]);
  const shown = menu.items.filter((i) => (cat === 'all' || i.category?._id === cat) && i.name.toLowerCase().includes(q.toLowerCase()));
  const pick = (i) => { if (i.modifierGroups?.length) { setPicking(i); setSel({}); } else dispatch(A.addLine({ lineId: i._id, _id: i._id, name: i.name, price: i.price, modifiers: [] })); };
  const confirmMods = () => {
    const groups = picking.modifierGroups; const names = Object.values(sel).flat();
    const missing = groups.find((g) => g.required && !(sel[g.name] || []).length); if (missing) return setErr(`Choose ${missing.name}`);
    const extra = groups.flatMap((g) => g.options).filter((o) => names.includes(o.name)).reduce((s, o) => s + o.price, 0);
    dispatch(A.addLine({ lineId: picking._id + '|' + [...names].sort().join(','), _id: picking._id, name: picking.name + (names.length ? ` (${names.join(', ')})` : ''), price: picking.price + extra, modifiers: names })); setPicking(null); setErr('');
  };
  const toggle = (g, o) => setSel((s) => ({ ...s, [g.name]: g.required ? [o.name] : (s[g.name] || []).includes(o.name) ? s[g.name].filter((x) => x !== o.name) : [...(s[g.name] || []), o.name] }));
  const t = useMemo(() => { // preview only; the server recomputes all totals
    const sub = cart.lines.reduce((s, x) => s + x.price * x.qty, 0); const v = +cart.discValue || 0;
    const d = cart.discType === 'percent' ? (sub * Math.min(v, 100)) / 100 : cart.discType === 'fixed' ? Math.min(v, sub) : 0;
    const tax = ((sub - d) * restaurant.taxRate) / 100; return { sub, d, tax, total: sub - d + tax };
  }, [cart, restaurant.taxRate]);
  const canDiscount = ['owner', 'manager'].includes(user.role); const set = (k) => (e) => dispatch(A.setField({ k, v: e.target.value }));
  const change = method === 'cash' && received ? Math.max(0, +received - t.total) : 0;
  const checkout = async () => {
    setBusy(true); setErr('');
    try {
      const { data: o } = await api.post('/orders', { type: cart.type, table: cart.type === 'dine-in' ? cart.table : undefined, customer: cart.customer || undefined, idempotencyKey: key.current, discountType: cart.discType, discountValue: +cart.discValue || 0, items: cart.lines.map((x) => ({ menuItem: x._id, qty: x.qty, notes: x.notes || undefined, modifiers: x.modifiers })) });
      const paid = await api.post(`/orders/${o._id}/payments`, { method, received: method === 'cash' && received ? +received : undefined });
      setDone(paid.data); dispatch(A.clear()); setReceived(''); key.current = newKey();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const ready = cart.lines.length && (cart.type !== 'dine-in' || cart.table) && (method !== 'cash' || !received || +received >= t.total - 0.005);
  return (
    <div className="pos-page">
      <section className="pos-menu">
        <div className="pos-search"><Search size={16} /><input placeholder="Search menu" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search menu" /></div>
        <div className="pos-tabs" role="tablist">{[{ _id: 'all', name: 'All' }, ...menu.categories].map((c) => <button key={c._id} role="tab" aria-selected={cat === c._id} className={`chip ${cat === c._id ? 'chip--on' : ''}`} onClick={() => setCat(c._id)}>{c.name}</button>)}</div>
        {shown.length === 0 ? <Empty title="No items found" /> : <div className="pos-menu-grid">{shown.map((i) => (
          <button key={i._id} className="menu-card" disabled={!i.available} onClick={() => pick(i)}>
            <span className="menu-card__img">{i.image ? <img src={imgUrl(i.image)} alt="" onError={(e) => { e.currentTarget.hidden = true; }} /> : i.name[0]}</span>
            <strong>{i.name}</strong><span className="muted menu-card__desc">{i.description}</span>
            <span className="menu-card__foot"><span className="num">{money(i.price)}</span>{!i.available && <em>Unavailable</em>}</span>
          </button>))}</div>}
      </section>
      <aside className="pos-cart-panel">
        <h2 className="serif">Current order</h2>
        <div className="seg">{['dine-in', 'takeaway', 'delivery'].map((x) => <button key={x} className={cart.type === x ? 'on' : ''} onClick={() => dispatch(A.setField({ k: 'type', v: x }))}>{x}</button>)}</div>
        {cart.type === 'dine-in' && <select value={cart.table} onChange={set('table')} aria-label="Table"><option value="">Select table…</option>{tables.map((x) => <option key={x._id} value={x._id}>Table {x.number} ({x.seats} seats) — {x.status.replace('_', ' ')}</option>)}</select>}
        <select value={cart.customer} onChange={set('customer')} aria-label="Customer"><option value="">Walk-in customer</option>{customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <div className="cart-lines">{cart.lines.length === 0 ? <Empty title="Cart is empty" hint="Tap a dish to add it." /> : cart.lines.map((x) => (
          <div className="cart-line" key={x.lineId}>
            <div className="cart-line__top"><strong>{x.name}</strong><span className="num">{money(x.price * x.qty)}</span></div>
            <div className="cart-line__ctl"><button className="btn btn--ghost btn--icon" aria-label="Decrease" onClick={() => dispatch(A.setQty({ lineId: x.lineId, qty: x.qty - 1 }))}><Minus size={16} /></button><span className="num">{x.qty}</span><button className="btn btn--ghost btn--icon" aria-label="Increase" onClick={() => dispatch(A.setQty({ lineId: x.lineId, qty: x.qty + 1 }))}><Plus size={16} /></button>
              <input placeholder="Note (e.g. no onion)" value={x.notes} onChange={(e) => dispatch(A.setNotes({ lineId: x.lineId, notes: e.target.value }))} /><button className="btn btn--ghost btn--icon" aria-label="Remove" onClick={() => dispatch(A.setQty({ lineId: x.lineId, qty: 0 }))}><Trash2 size={16} /></button></div>
          </div>))}</div>
        {canDiscount && <div className="inline"><select value={cart.discType} onChange={set('discType')} aria-label="Discount type"><option value="none">No discount</option><option value="percent">% off</option><option value="fixed">Fixed off</option></select>{cart.discType !== 'none' && <input type="number" min="0" value={cart.discValue} onChange={set('discValue')} aria-label="Discount value" />}</div>}
        <div className="totals"><div className="row"><span>Subtotal</span><span className="num">{money(t.sub)}</span></div>{t.d > 0 && <div className="row"><span>Discount</span><span className="num">−{money(t.d)}</span></div>}<div className="row"><span>Tax ({restaurant.taxRate}%)</span><span className="num">{money(t.tax)}</span></div><div className="row row--total"><span>Total</span><span className="num">{money(t.total)}</span></div></div>
        <div className="seg">{(restaurant.paymentMethods || ['cash']).map((x) => <button key={x} className={method === x ? 'on' : ''} onClick={() => setMethod(x)}>{x}</button>)}</div>
        {method === 'card' && <p className="muted small">Card is recorded manually. No payment provider is connected.</p>}
        {method === 'cash' && <div className="inline"><input type="number" min="0" placeholder="Cash received" value={received} onChange={(e) => setReceived(e.target.value)} aria-label="Cash received" /><span className="num">Change {money(change)}</span></div>}
        <Alert error={err} />
        <button className="btn btn--block btn--lg" disabled={!ready || busy} onClick={checkout}>{busy ? 'Processing…' : `Charge ${money(t.total)}`}</button>
      </aside>
      {picking && <div className="modal-wrap" role="dialog" aria-modal="true"><div className="modal"><h3>{picking.name}</h3>
        {picking.modifierGroups.map((g) => <fieldset className="mod-group" key={g.name}><legend>{g.name}{g.required ? ' *' : ''}</legend>{g.options.map((o) => <label key={o.name} className="mod-opt"><input type={g.required ? 'radio' : 'checkbox'} name={g.name} checked={(sel[g.name] || []).includes(o.name)} onChange={() => toggle(g, o)} /> {o.name}{o.price > 0 && <span className="num muted"> +{money(o.price)}</span>}</label>)}</fieldset>)}
        <Alert error={err} /><div className="modal__actions"><button className="btn btn--ghost" onClick={() => setPicking(null)}>Cancel</button><button className="btn" onClick={confirmMods}>Add to order</button></div></div></div>}
      {done && <Receipt order={done} restaurant={restaurant} money={money} onClose={() => setDone(null)} />}
    </div>
  );
}
