import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, errMsg, imgUrl } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Badge } from '../components/ui.jsx';

const cropImage = async (src, { zoom, x, y }) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Could not load this image for cropping.'));
  });
  image.src = src;
  await loaded;

  const aspect = 4 / 3;
  let width = image.naturalWidth;
  let height = image.naturalHeight;
  if (width / height > aspect) width = height * aspect;
  else height = width / aspect;
  width /= zoom;
  height /= zoom;

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image cropping is unavailable in this browser.');
  context.drawImage(
    image,
    (image.naturalWidth - width) * (x / 100),
    (image.naturalHeight - height) * (y / 100),
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not crop this image.'))),
      'image/jpeg',
      0.88,
    );
  });
};

// Modifier text format, one group per line:  Size*: Regular=0, Large=400   (* = required)
const toText = (gs = []) => gs.map((g) => `${g.name}${g.required ? '*' : ''}: ${g.options.map((o) => `${o.name}=${o.price}`).join(', ')}`).join('\n');
const parse = (txt) => txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [head, rest = ''] = l.split(':'); const required = head.trim().endsWith('*');
  return { name: head.replace('*', '').trim(), required, options: rest.split(',').map((o) => o.trim()).filter(Boolean).map((o) => { const [name, p] = o.split('='); return { name: name.trim(), price: +p || 0 }; }) };
});
export default function Menu() {
  const { money } = useAuth();
  const [data, setData] = useState({ items: [], categories: [] }); const [q, setQ] = useState(''); const [err, setErr] = useState(''); const [edit, setEdit] = useState(null); const [newCat, setNewCat] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [crop, setCrop] = useState({ zoom: 1, x: 50, y: 50 });
  const [cropChanged, setCropChanged] = useState(false);
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => {
    if (!imageFile) {
      setFilePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  const imagePreview = imageFile ? filePreview : edit?.image ? imgUrl(edit.image) : '';
  const load = () => api.get('/menu', { params: { all: 1 } }).then((r) => setData(r.data)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const act = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(errMsg(e)); } };
  const open = (i) => {
    setImageFile(null);
    setCrop({ zoom: 1, x: 50, y: 50 });
    setCropChanged(false);
    setEdit(i || {});
    reset(i ? { name: i.name, price: i.price, description: i.description || '', category: i.category?._id, station: i.station, modifiers: toText(i.modifierGroups) } : { station: 'kitchen', modifiers: '' });
  };
  const save = handleSubmit((v) => act(async () => {
    const body = { name: v.name, price: +v.price, description: v.description, category: v.category, station: v.station };
    const cropped = imageFile || (cropChanged && edit.image)
      ? await cropImage(imageFile ? imagePreview : imgUrl(edit.image), crop)
      : null;
    let id = edit._id;
    if (id) await api.patch(`/menu/${id}`, { ...body, modifierGroups: parse(v.modifiers) });
    else {
      id = (await api.post('/menu', body)).data._id;
      setEdit((current) => ({ ...current, _id: id }));
      if (v.modifiers) await api.patch(`/menu/${id}`, { modifierGroups: parse(v.modifiers) });
    }
    if (cropped) {
      const fd = new FormData();
      fd.append('image', cropped, 'menu-item.jpg');
      await api.post(`/menu/${id}/image`, fd);
    }
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
        <div className="field menu-image-editor">
          <label htmlFor="menu-image">Image (JPG/PNG/WebP, max 2MB)</label>
          {imagePreview ? (
            <>
              <div className="menu-image-editor__preview">
                <img
                  src={imagePreview}
                  alt="Menu item crop preview"
                  crossOrigin="anonymous"
                  style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})` }}
                />
              </div>
              <div className="menu-image-editor__controls">
                <label>Zoom
                  <input type="range" min="1" max="3" step="0.05" value={crop.zoom} onChange={(e) => { setCrop({ ...crop, zoom: +e.target.value }); setCropChanged(true); }} />
                </label>
                <label>Horizontal crop
                  <input type="range" min="0" max="100" value={crop.x} onChange={(e) => { setCrop({ ...crop, x: +e.target.value }); setCropChanged(true); }} />
                </label>
                <label>Vertical crop
                  <input type="range" min="0" max="100" value={crop.y} onChange={(e) => { setCrop({ ...crop, y: +e.target.value }); setCropChanged(true); }} />
                </label>
              </div>
            </>
          ) : (
            <p className="muted small">No image selected.</p>
          )}
          {edit.image && !imageFile && <small className="muted">Current image shown. Leave the file picker empty to keep it.</small>}
          <input
            id="menu-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              setImageFile(e.target.files?.[0] || null);
              setCrop({ zoom: 1, x: 50, y: 50 });
              setCropChanged(false);
            }}
          />
        </div>
        <div className="modal__actions"><button type="button" className="btn btn--ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn">Save</button></div></form></div>}
    </div>
  );
}
