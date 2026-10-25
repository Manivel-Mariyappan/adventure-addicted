# Adventure Addicted Company

Website and back office for a North India tour company: guided bike expeditions, self-drive
road trips and group tours to Ladakh, Kashmir, Spiti, Himachal, Uttarakhand and Rajasthan.

This version is **front end only**. There is no server or database: the website reads JSON files,
customers send booking requests on WhatsApp, and the admin keeps bookings in its browser. The
data shapes follow the planned ASP.NET Core + MySQL backend, so it can be connected later.

- Angular 21 (standalone components, signals, zoneless), TypeScript
- Admin and coordinator portals: Bootstrap 5, ng-select, AG Grid, ng-bootstrap, SweetAlert2

## Quick start

```bash
npm install
npm start            # http://localhost:4200
npm test             # unit tests (pricing, seats, booking messages, payments)
npm run build        # production build -> dist/adventure-addicted/browser
```

| Part | URL | Sign in |
|---|---|---|
| Website | `/` | none |
| Admin | `/admin` | **admin / aac@admin** |
| Coordinator portal | `/coordinator` | pick a name, PIN **1234** (demo coordinators) |

## How booking works

1. A customer picks a tour, a departure and how to travel (our bike, own car, or a seat in our
   vehicle), adds travellers and extras, and sees the price with GST, the advance and the
   balance due date.
2. **Send booking request** opens WhatsApp with a message and a reference such as `AAC-7K2P9Q`.
   The request is also saved on the customer's device under **My trips**.
3. In the admin, **Bookings > Add booking > paste the message**. Everything is filled in. Record
   the advance, set the status to Confirmed, and the seats are taken.
4. Unpaid requests hold their seats for 48 hours (Company settings). A full departure takes
   waitlist requests instead.
5. **Publish** writes the seat counts into `departures.json` and the booking status into
   `booking-status.json` (reference, status and amounts only), so the website and My trips
   show the latest.

No money is taken online. Razorpay needs a server to create and verify payments, so it is left
for the backend.

## Coordinators

Each departure has a coordinator. On the departure page the office downloads a **trip pack**
(passengers, emergency contacts, arrangements) and sends it to the coordinator privately. In the
coordinator portal they open it and, on the road, take attendance, check people in, post
announcements to the group, log incidents and expenses and send daily reports. At the end they
download a **trip report** file, which the office imports on the departure page. Expenses then
show up in the profit figures.

Passenger details never go into the public JSON files.

## Data files (`public/data/`)

| File | What it holds | Edited in |
|---|---|---|
| `tours.json` | packages, itineraries, travel options, prices, policies | Admin > Tour packages |
| `departures.json` | dates, seats per option, prices, coordinator, seats taken | Admin > Departures |
| `destinations.json` | regions and places | Admin > Destinations |
| `coordinators.json` | name, bio, phone, PIN hash | Admin > Coordinators |
| `settings.json` | contact, WhatsApp, GST, advance %, FAQs, reviews | Admin > Company settings |
| `booking-status.json` | status by booking reference | written by Publish |

Admin edits are drafts in the browser until you download the files from **Publish**, replace
them in `public/data/` and deploy. Bookings, payments and departure notes stay in the admin's
browser: use **Publish > Download backup** regularly.

## Before going live

- [ ] Change the admin password (`adminPasscodeSha256` in `src/app/core/config/app-config.ts`)
      and give each coordinator their own PIN.
- [ ] Add the office address, email and social links in Company settings. WhatsApp and phone are
      set to 97869 95053.
- [ ] Check every tour's prices, inclusions and cancellation policy. The demo tours, departures
      and coordinators are examples.
- [ ] Delete the demo bookings (Bookings page) and publish `departures.json` again.
- [ ] Replace the illustrations in `public/art/` with real photos (upload them in the admin, or
      add paths).
- [ ] Add real customer reviews in Company settings; the section stays hidden until then.

## Project layout

```
public/data/          JSON content (see above)
public/art/           illustrations for destinations and tours
src/app/core/         models, pricing and seat rules, booking message, services
src/app/shared/       header, footer, tour card, departure list, itinerary
src/app/features/     website pages (home, tours, tour, booking, destinations, my trips)
src/admin/            admin portal (bookings, departures, tours, reports, publish)
src/coordinator/      coordinator portal
```

The passwords and PINs only keep casual visitors out: their hashes ship with the website. Real
logins, payments and shared data need the backend.
