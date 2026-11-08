# SERVORA — Testing Guide (all roles & features)

Run `npm run seed` first for a clean state. Password for all demo users: `Servora@123`.
Use separate browser profiles (or private windows) so each role has its own session.
Legend: ✅ should work, ⛔ should be blocked.

## 1. Automated checks
```bash
npm test                        # totals, discounts, state machine, duplicate checkout,
                                # stock deduction, refund rules, cancel restock, role access
npm --prefix server run lint && npm --prefix client run lint
npm run build
```

## 2. Role access matrix
| Feature | Owner | Manager | Cashier | Waiter | Kitchen |
|---|---|---|---|---|---|
| Sidebar pages | all 11 | all 11 | POS, Tables, Orders, Customers | POS, Tables, Orders | Kitchen only |
| Overview / Reports / Inventory / Menu edit | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Create orders + take payment | ✅ | ✅ | ✅ | ✅ | ⛔ |
| Apply discounts | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Cancel unpaid order | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Refund | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Kitchen: Start / Mark ready | ✅ | ✅ | n/a | n/a | ✅ |
| Kitchen: Served | ✅ | ✅ | n/a | n/a | hidden |
| Add / edit customers | ✅ | ✅ | ✅ | view only | ⛔ |
| Team: add staff, change roles, deactivate | ✅ | view + activity | ⛔ | ⛔ | ⛔ |
| Settings: edit | ✅ | read-only | ⛔ | ⛔ | ⛔ |

**Quick UI check:** log in as each role and compare the sidebar to the table. Type a forbidden URL (e.g. `/reports` as cashier) -> 404 page.

## 3. Server-side permission tests (curl)
The UI hides things; the server must still refuse. Example as cashier:
```bash
API=http://localhost:5000/api
curl -s -c jar -H 'content-type: application/json' -d '{"email":"cashier@servora.test","password":"Servora@123"}' $API/auth/login
curl -s -b jar $API/dashboard/summary            # ⛔ {"error":"Forbidden"}
curl -s -b jar $API/inventory                    # ⛔ Forbidden
curl -s -b jar -X POST $API/orders/<orderId>/refunds -H 'content-type: application/json' -d '{"amount":10,"reason":"x"}'   # ⛔ Only managers can refund
```
As kitchen: `PATCH /orders/<id>/status {"status":"served"}` -> ⛔ "Kitchen can only mark preparing/ready". No cookie at all -> 401.

## 4. Feature test scripts

### Authentication
- Wrong password -> "Invalid email or password". Empty fields blocked.
- Deactivate a user in Team, then try to log in as them -> ⛔. If already logged in, their next action returns "Account inactive".
- 21+ failed logins in 15 min -> 429 (rate limit).
- Log out, press Back -> login screen, no data.

### POS (cashier)
1. Empty cart shows the empty state; Charge disabled.
2. Dine-in with no table -> Charge disabled. Choose a table.
3. Margherita Pizza opens the add-on dialog; Add without Size -> "Choose Size". Choose Large + Extra cheese -> price rises.
4. Same dish with different add-ons becomes separate cart lines. +/- and remove work.
5. Cash received below total -> Charge disabled; above total -> change shows.
6. Card shows "recorded manually" note. Charge -> receipt with correct subtotal/tax/total; Print opens the print dialog.
7. Cashier sees no discount control. Log in as manager: 10% discount lowers total before tax.
8. **Duplicate prevention:** double-click Charge quickly -> only one new order in Orders. Via curl, POST /orders twice with the same `idempotencyKey` -> same order id both times.
9. Mark a dish unavailable in Menu -> it's disabled in POS.
10. Price tampering: the server ignores prices sent by the client (only item ids and quantities are used).

### Tables
Available -> Start order opens POS with that table. Reserve / Release. Bill requested. Transfer an active order to an available table. Combine with another table (label shows `+1`). After the order is Completed or Cancelled, tables return to Available.

### Kitchen (kitchen role, tablet width)
New ticket appears without refresh. Start -> Mark ready. Items show add-ons and notes. Wait past 15 min (or set prep target to 1 in Settings) -> red LATE card. Refresh or stop/start the server -> tickets reload correctly.

### Menu (manager)
Create, edit (add-ons text format `Size*: Regular=0, Large=400`), upload image (JPG/PNG/WebP <= 2MB -> shows in POS), mark unavailable, archive (disappears from POS but old orders keep it), add category, search. Uploading a GIF or >2MB file must be rejected.

### Inventory (manager)
Receive stock (positive only). Adjust with reason (negative allowed). Order a dish -> ingredient drops; Ledger shows a "usage" row. Reduce below minimum -> Low badge, bell alert, Overview "Low stock". Cancel an unpaid order -> stock restored, ledger shows the reversal.

### Orders & refunds
Filters (number, status, type, payment) and pagination. Take cash on an unpaid order. Complete a served + paid order. Cancel needs a reason; paid orders can't be cancelled. Refund: more than paid -> error; valid partial refund -> "partially refunded"; refund the rest -> "refunded". Reason is required.

### Customers
Add customer; select in POS; pay; History shows the order; points rise (1 per 100 spent).

### Reports & Overview (manager)
Range filters (today, 7d, 30d, custom). Numbers match the seed (42 completed orders over 7 days). Empty range shows empty states. CSV downloads open in Excel and match the on-screen numbers. Refunds reduce net sales on Overview.

### Team & Settings (owner)
Add staff -> they can log in with the role's access. Change role -> takes effect on their next page load. Deactivate/activate. Activity shows audit entries (refunds, discounts). Settings: change currency/tax -> POS totals and receipt update. Turn off a payment method -> disappears from POS. Add a table.

### Notifications
Bell shows low-stock and "Order ready" alerts live; opening it clears the badge. Turning the toggles off in Settings stops new ones.

## 5. Security checks
- Login with `{"email":{"$ne":""},"password":"x"}` -> 400 validation error (no injection).
- Cookie `token` is HttpOnly (DevTools -> Application -> Cookies).
- Open a socket without logging in -> connection refused.
- Edit an order id from another restaurant (needs a second restaurant in the DB) -> 404.

## 6. Responsive & accessibility
Use DevTools device mode at 320, 375, 390, 430, 768, 1024, 1440, 1920 px on POS, Kitchen, Orders and Reports. Expect: no horizontal page scroll, sidebar becomes a drawer under 992px, tables turn into cards under 768px, 44px touch targets. Keyboard: Tab through the login and POS; focus ring (gold outline) must always be visible; Esc/close buttons work on dialogs.

## 7. Known limits while testing
Oversized image uploads show a generic "Server error" instead of a friendly message. Preparation stations are labels only. Dish photos are letter placeholders until you upload them.
