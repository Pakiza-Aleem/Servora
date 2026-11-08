export const Badge = ({ status }) => <span className={`badge badge--${status}`}>{String(status).replace('_', ' ')}</span>;
export const Empty = ({ title, hint }) => <div className="empty"><strong>{title}</strong>{hint && <p>{hint}</p>}</div>;
export const Alert = ({ error }) => (error ? <div className="alert" role="alert">{error}</div> : null);
export const minutesSince = (d) => Math.max(0, Math.floor((Date.now() - new Date(d)) / 60000));
export function Receipt({ order, restaurant, money, onClose }) {
  const paid = order.payments?.reduce((s, p) => s + p.amount, 0) || 0;
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true">
      <div className="modal receipt">
        <h3 className="serif center">{restaurant.name}</h3>
        <p className="center muted">Order #{order.number} · {order.type} · {new Date(order.createdAt).toLocaleString()}</p>
        {order.items.map((i, k) => <div className="row" key={k}><span>{i.qty} × {i.name}</span><span>{money(i.qty * i.price)}</span></div>)}
        <hr />
        <div className="row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="row"><span>Discount</span><span>−{money(order.discount)}</span></div>}
        <div className="row"><span>Tax ({restaurant.taxRate}%)</span><span>{money(order.tax)}</span></div>
        <div className="row row--total"><span>Total</span><span>{money(order.total)}</span></div>
        <div className="row muted"><span>Paid</span><span>{money(paid)}</span></div>
        <p className="center muted">{restaurant.receiptFooter}</p>
        <div className="modal__actions no-print"><button className="btn" onClick={() => window.print()}>Print</button><button className="btn btn--ghost" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
