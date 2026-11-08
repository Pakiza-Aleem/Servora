import { configureStore, createSlice } from '@reduxjs/toolkit';
const cart = createSlice({
  name: 'cart',
  initialState: { lines: [], type: 'dine-in', table: '', customer: '', discType: 'none', discValue: 0 },
  reducers: {
    addLine(s, { payload }) { const f = s.lines.find((l) => l.lineId === payload.lineId); if (f) f.qty += 1; else s.lines.push({ ...payload, qty: 1, notes: '' }); },
    setQty(s, { payload: { lineId, qty } }) { const l = s.lines.find((x) => x.lineId === lineId); if (l) l.qty = qty; s.lines = s.lines.filter((x) => x.qty > 0); },
    setNotes(s, { payload: { lineId, notes } }) { const l = s.lines.find((x) => x.lineId === lineId); if (l) l.notes = notes; },
    setField(s, { payload: { k, v } }) { s[k] = v; },
    clear(s) { s.lines = []; s.discType = 'none'; s.discValue = 0; s.customer = ''; },
  },
});
const notifications = createSlice({
  name: 'notifications', initialState: { list: [] },
  reducers: { setAll(s, { payload }) { s.list = payload; }, push(s, { payload }) { s.list.unshift(payload); }, readAll(s) { s.list.forEach((n) => { n.read = true; }); } },
});
export const cartActions = cart.actions;
export const notifActions = notifications.actions;
export const store = configureStore({ reducer: { cart: cart.reducer, notifications: notifications.reducer } });
