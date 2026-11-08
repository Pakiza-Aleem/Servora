import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert } from '../components/ui.jsx';
import '../styles/settings.css';
export default function Settings() {
  const { restaurant, user, refresh } = useAuth(); const ro = user.role !== 'owner';
  const { register, handleSubmit } = useForm({ defaultValues: { ...restaurant, paymentMethods: restaurant.paymentMethods || [] } });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [tables, setTables] = useState([]);
  const tbl = useForm({ defaultValues: { seats: 4 } });
  const loadTables = () => api.get('/tables').then((r) => setTables(r.data));
  useEffect(() => { loadTables(); }, []);
  const save = handleSubmit(async (v) => {
    try { setErr(''); setMsg(''); await api.patch('/settings', { name: v.name, currency: v.currency.toUpperCase(), taxRate: +v.taxRate, receiptHeader: v.receiptHeader || '', receiptFooter: v.receiptFooter || '', address: v.address || '', phone: v.phone || '', orderCounter: +v.orderCounter, prepTargetMinutes: +v.prepTargetMinutes, paymentMethods: v.paymentMethods, notifyLowStock: !!v.notifyLowStock, notifyOrderReady: !!v.notifyOrderReady }); await refresh(); setMsg('Saved'); } catch (e) { setErr(errMsg(e)); }
  });
  const addTable = tbl.handleSubmit(async (v) => { try { await api.post('/tables', { number: +v.number, seats: +v.seats }); tbl.reset({ seats: 4 }); loadTables(); } catch (e) { setErr(errMsg(e)); } });
  return (
    <div className="page settings-page"><div className="page-head"><h1 className="serif">Settings</h1></div><Alert error={err} />{msg && <p className="success-note">{msg}</p>}{ro && <p className="muted">Only the owner can change settings.</p>}
      <form className="card settings-form" onSubmit={save}><fieldset disabled={ro}>
        <h3>Restaurant &amp; receipts</h3>
        <div className="settings-grid">
          <label className="field">Name<input {...register('name', { required: true })} /></label><label className="field">Phone<input {...register('phone')} /></label>
          <label className="field">Address<input {...register('address')} /></label><label className="field">Receipt header<input {...register('receiptHeader')} /></label>
          <label className="field">Receipt footer<input {...register('receiptFooter')} /></label><label className="field">Currency (ISO code)<input maxLength={3} {...register('currency', { required: true })} /></label>
          <label className="field">Tax rate %<input type="number" step="0.01" min="0" max="100" {...register('taxRate')} /></label><label className="field">Next order number<input type="number" min="0" {...register('orderCounter')} /></label>
          <label className="field">Prep-time target (min)<input type="number" min="1" {...register('prepTargetMinutes')} /></label></div>
        <h3>Payment methods</h3><div className="inline">{['cash', 'card', 'other'].map((m) => <label key={m} className="mod-opt"><input type="checkbox" value={m} {...register('paymentMethods')} /> <span className="capitalize">{m}</span></label>)}</div>
        <h3>Notifications</h3><div className="inline"><label className="mod-opt"><input type="checkbox" {...register('notifyLowStock')} /> Low-stock alerts</label><label className="mod-opt"><input type="checkbox" {...register('notifyOrderReady')} /> Order-ready alerts</label></div>
        <button className="btn settings-save">Save settings</button></fieldset></form>
      <section className="card"><h3>Table configuration</h3>
        {!ro && <form className="form-row" onSubmit={addTable}><input required type="number" min="1" placeholder="Table number" {...tbl.register('number')} /><input required type="number" min="1" placeholder="Seats" {...tbl.register('seats')} /><button className="btn">Add table</button></form>}
        <div className="inline">{tables.map((t) => <span key={t._id} className="chip">T{t.number} · {t.seats} seats</span>)}</div></section>
    </div>
  );
}
