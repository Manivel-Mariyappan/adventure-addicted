import { Office } from '../models';

// Shop 14, Main Bazaar Road, Leh, Ladakh 194101
export function officeAddress(o: Office): string {
  const place = [o.city, [o.state, o.postalCode].filter(Boolean).join(' ')].filter(Boolean);
  return [o.address, ...place].filter(Boolean).join(', ');
}

const query = (o: Office) => encodeURIComponent(o.mapQuery || officeAddress(o));

export const mapEmbedUrl = (o: Office): string =>
  `https://www.google.com/maps?q=${query(o)}&output=embed`;

export const directionsUrl = (o: Office): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${query(o)}`;
