// Company details (phone, WhatsApp, GST, advance %) are in public/data/settings.json, not here.
export const APP_CONFIG = {
  // e.g. 'https://www.adventureaddicted.in'. Leave empty to use the current domain.
  siteUrl: '',

  dataUrls: {
    destinations: 'data/destinations.json',
    tours: 'data/tours.json',
    departures: 'data/departures.json',
    coordinators: 'data/coordinators.json',
    settings: 'data/settings.json',
    bookingStatus: 'data/booking-status.json',
  },

  // SHA-256 of the admin password (default: aac@admin). To change it:
  // node -e "console.log(require('crypto').createHash('sha256').update('NEW-PASSWORD').digest('hex'))"
  adminPasscodeSha256: 'a0493c003f61ff1e65286c1d907535fc6b84e5f63f2cc997f76dffa32db5999c',
} as const;
