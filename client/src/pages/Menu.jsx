import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, errMsg } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Badge } from '../components/ui.jsx';
// Modifier text format, one group per line:  Size*: Regular=0, Large=400   (* = required)
const toText = (gs = []) => gs.map((g) => `${g.name}${g.required ? '*' : ''}: ${g.options.map((o) => `${o.name}=${o.price}`).join(', ')}`).join('\n');
const parse = (txt) => txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [head, rest = ''] = l.split(':'); const required = head.trim().endsWith('*');
  return { name: head.replace('*', '').trim(), required, options: rest.split(',').map((o) => o.trim()).filter(Boolean).map((o) => { const [name, p] = o.split('='); return { name: name.trim(), price: +p || 0 }; }) };
});
export default function Menu() {
  const { money } = useAuth();
  const [data, setData] = useState({ items: [], categories: [] }); const [q, setQ] = useState(''); const [err, setErr] = useState(''); const [edit, setEdit] = useState(null); const [newCat, setNewCat] = useState('');
  const { register, handleSubmit, reset } = useForm();
  const load = () => api.get('/menu', { params: { all: 1 } }).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const act = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(errMsg(e)); } };
  const open = (i) => { setEdit(i || {}); reset(i ? { name: i.name, price: i.price, description: i.description || '', category: i.category?._id, station: i.station, modifiers: toText(i.modifierGroups) } : { station: 'kitchen', modifiers: '' }); };
  const save = handleSubmit((v) => act(async () => {
    const body = { name: v.name, price: +v.price, description: v.description, category: v.category, station: v.station };
    let id = edit._id;
    if (id) await api.patch(`/menu/${id}`, { ...body, modifierGroups: parse(v.modifiers) }); else { id = (await api.post('/menu', body)).data._id; if (v.modifiers) await api.patch(`/menu/${id}`, { modifierGroups: parse(v.modifiers) }); }
    if (v.image?.[0]) { const fd = new FormData(); fd.append('image', v.image[0]); await api.post(`/menu/${id}/image`, fd); }
    setEdit(null);
  }));
  return (
    <div className="page"><div className="page-head"><h1 className="serif">Menu</h1><div className="inline"><input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" /><button className="btn" onClick={() => open()}>New item</button></div></div><Alert error={err} />
      <form className="card form-row" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post('/categories', { name: newCat }); setNewCat(''); }); }}><input required placeholder="New category name" value={newCat} onChange={(e) => setNewCat(e.target.value)} /><button className="btn btn--ghost">Add category</button></form>
      <div className="table-wrap"><table className="table"><thead><tr><th>Item</th><th>Category</th><th>Station</th><th>Price</th><th>Status</th><th></th></tr></thead><tbody>
        {data.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase())).map((i) => (
          <tr key={i._id}><td data-label="Item">{i.name}</td><td data-label="Category">{i.category?.name}</td><td data-label="Station">{i.station}</td><td data-label="Price" className="num">{money(i.price)}</td>
            <td data-label="Status"><Badge status={!i.active ? 'archived' : i.available ? 'available' : 'unavailable'} /></td>
            <td className="actions">{i.active && <><button className="btn btn--ghost" onClick={() => open(i)}>Edit</button><button className="btn btn--ghost" onClick={() => act(() => api.patch(`/menu/${i._id}`, { available: !i.available }))}>{i.available ? 'Mark unavailable' : 'Mark available'}</button><button className="btn btn--ghost" onClick={() => window.confirm('Archive this item?') && act(() => api.delete(`/menu/${i._id}`))}>Archive</button></>}</td></tr>))}
      </tbody></table></div>
      {edit && <div className="modal-wrap" role="dialog" aria-modal="true"><form className="modal" onSubmit={save}><h3>{edit._id ? 'Edit item' : 'New item'}</h3>
        <label className="field">Name<input {...register('name', { required: true })} /></label>
        <label className="field">Price<input type="number" min="0" {...register('price', { required: true })} /></label>
        <label className="field">Category<select {...register('category', { required: true })}><option value="">Choose…</option>{data.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label>
        <label className="field">Station<select {...register('station')}>{['kitchen', 'grill', 'bar', 'dessert'].map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field">Description<input {...register('description')} /></label>
        <label className="field">Sizes &amp; add-ons<textarea rows="3" placeholder="Size*: Regular=0, Large=400" {...register('modifiers')} /></label>
        <label className="field">Image (JPG/PNG/WebP, max 2MB)<input type="file" accept="image/jpeg,image/png,image/webp" {...register('image')} /></label>
        <div className="modal__actions"><button type="button" className="btn btn--ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn">Save</button></div></form></div>}
    </div>
  );
}
