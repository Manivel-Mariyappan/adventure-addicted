# SMP Electricals & Hardware

Website for an electrical and hardware shop. Customers browse products with MRP and shop price,
see current offers and services, and order on **WhatsApp**. There is no cart or online payment.

- **Angular 21** (standalone components, signals, zoneless), TypeScript
- **No backend.** All content lives in JSON files in `public/data/`
- Admin panel in `src/admin/` (Bootstrap, ng-select, AG Grid, ng-bootstrap datepicker, SweetAlert2)

## Quick start

```bash
npm install
npm start            # http://localhost:4200
npm test             # unit tests
npm run build        # production build -> dist/smp-electrical/browser
```

## Pages

| Route | Page |
|---|---|
| `/` | Home: search, quick enquiry, categories, offers, deals, brands, new arrivals, services, visit us |
| `/categories` | All categories by department, with search |
| `/products` | All products with category, brand, price, stock and offer filters |
| `/products/:slug` | Product detail: MRP, our price, discount, quantity, specs, order on WhatsApp |
| `/offers` | Current offers and their products |
| `/services` | Electrician, plumbing, delivery and bulk orders |
| `/about`, `/contact` | About the shop, address, phone, hours and map |
| `/admin` | Admin panel |

## Admin

Open `/admin` and sign in with **admin / smp@admin**. Change the passcode before going live: put
the SHA-256 hash of the new passcode in `adminPasscodeSha256` in
`src/app/core/config/app-config.ts`.

The admin manages products, categories, brands, offers and shop settings. Categories are grouped
into departments (for example Electrical with Wires & Cables inside it), and the ones marked
**Featured** show in the header, on the home page and in the footer. All the others are in the
"All categories" menu, which has a search box, so 50 or more categories are fine.

Changes are saved as drafts in the browser, so you can see them on the website straight away. To
make them live for everyone:

1. Open **Publish** and download the JSON files.
2. Replace the files in `public/data/` with them.
3. Build and deploy again.

**Orders**: when a customer sends an order list on WhatsApp, open Orders, click Add order and paste
the message. Items, quantities, prices, the customer name and the order ref (e.g. SMP-261025-4821)
are filled in, and pasting the same order twice is caught. The **Dashboard** counts single-product
orders, bulk orders and enquiries for a period; click a card to see which products were asked for.

Orders, enquiries and admin users are saved in the admin's browser only, ready for a backend
later.

## Before going live

- [ ] Fill in the shop address, email and GSTIN in **Shop settings**
      (or `public/data/settings.json`). WhatsApp and phone are already set to 97869 95053.
- [ ] Replace the demo products. They use made-up brand names and drawn images. Use
      **Delete demo products** on the Products page and add the real stock.
- [ ] Replace the demo categories with your own in **Categories**, and mark 8 to 12 as Featured.
- [ ] Add real brands and offers.
- [ ] Change the admin passcode.

## Project layout

```
public/data/          products.json, categories.json, brands.json, offers.json, settings.json
public/demo/          demo product and category images
src/app/core/         models, config, services (content, products, WhatsApp, SEO)
src/app/shared/       header, footer, product card, offer banner, quick enquiry
src/app/features/     website pages
src/admin/            admin panel (separate routes and styles)
```
