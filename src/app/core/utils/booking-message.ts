import { TourPackage } from '../models';
import { formatRange } from './dates';
import { formatInr } from './price';

export interface Traveller {
  name: string;
  age: number | null;
  gender: '' | 'Male' | 'Female' | 'Other';
}

export interface LeadContact {
  name: string;
  phone: string;
  email: string;
  city: string;
}

// What the website sends on WhatsApp and the admin reads back in (Bookings > Paste request).
export interface BookingRequest {
  ref: string;
  waitlist: boolean;
  tourCode: string;
  departureCode: string;
  startDate: string;
  endDate: string;
  optionId: string;
  travellers: number;
  addOns: Record<string, number>;
  people: Traveller[];
  lead: LeadContact;
  notes: string;
  total: number;
  advance: number;
}

export function bookingMessage(request: BookingRequest, tour: TourPackage): string {
  const option = tour.travelOptions.find((o) => o.id === request.optionId);
  const addOns = tour.addOns
    .filter((a) => request.addOns[a.id])
    .map((a) => (a.unit === 'person' ? `${a.label} × ${request.addOns[a.id]}` : a.label));
  const people = request.people.map(
    (p, i) => `${i + 1}. ${[p.name, p.age ?? '', p.gender].filter((v) => v !== '').join(', ')}`,
  );
  const lead = [request.lead.name, request.lead.phone, request.lead.email, request.lead.city]
    .filter(Boolean)
    .join(', ');

  return [
    `*${request.waitlist ? 'Waitlist request' : 'Booking request'}* ${request.ref}`,
    `Tour: ${tour.name} (${tour.code})`,
    `Departure: ${formatRange(request.startDate, request.endDate)} (${request.departureCode})`,
    `Travel: ${option?.label ?? request.optionId} [${request.optionId}] × ${request.travellers}`,
    addOns.length ? `Add-ons: ${addOns.join('; ')}` : '',
    'Travellers:',
    ...people,
    `Lead: ${lead}`,
    request.notes ? `Notes: ${request.notes}` : '',
    `Total: ${formatInr(request.total)} (advance ${formatInr(request.advance)})`,
    request.waitlist
      ? 'Please add us to the waitlist and let us know if seats open up.'
      : 'Please confirm the seats and share the payment details.',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export interface ParsedRequest {
  ref: string;
  waitlist: boolean;
  departureCode: string;
  optionId: string;
  travellers: number;
  addOnLabels: Record<string, number>;
  people: Traveller[];
  lead: LeadContact;
  notes: string;
}

// Reads a pasted booking request. Returns null when the text has no booking reference.
export function parseBookingMessage(text: string): ParsedRequest | null {
  const ref = /\b(AAC-[A-Z0-9]{6})\b/.exec(text)?.[1];
  if (!ref) return null;

  const line = (label: string) =>
    new RegExp(`^\\s*${label}:\\s*(.+)$`, 'im').exec(text)?.[1].trim() ?? '';

  const travel = /\[([\w-]+)\]\s*[×x]\s*(\d+)/.exec(line('Travel'));
  const addOnLabels: Record<string, number> = {};
  for (const part of line('Add-ons')
    .split(';')
    .filter((p) => p.trim())) {
    const [, label, qty] = /^\s*(.+?)(?:\s*[×x]\s*(\d+))?\s*$/.exec(part)!;
    addOnLabels[label] = qty ? Number(qty) : 1;
  }

  const people: Traveller[] = [];
  const list = /Travellers:\s*\n([\s\S]*?)\n\s*Lead:/i.exec(text)?.[1] ?? '';
  for (const row of list.split('\n')) {
    const match = /^\s*\d+\.\s*(.+)$/.exec(row);
    if (!match) continue;
    const [name, ...rest] = match[1].split(',').map((s) => s.trim());
    const age = rest.find((v) => /^\d+$/.test(v));
    const gender = rest.find((v) => /^(Male|Female|Other)$/i.test(v)) ?? '';
    people.push({
      name,
      age: age ? Number(age) : null,
      gender: (gender.charAt(0).toUpperCase() +
        gender.slice(1).toLowerCase()) as Traveller['gender'],
    });
  }

  const [name = '', ...contact] = line('Lead')
    .split(',')
    .map((s) => s.trim());
  const lead: LeadContact = {
    name,
    phone: contact.find((v) => /\d{8,}/.test(v.replace(/\D/g, ''))) ?? '',
    email: contact.find((v) => v.includes('@')) ?? '',
    city: contact.find((v) => !v.includes('@') && !/\d{8,}/.test(v.replace(/\D/g, ''))) ?? '',
  };

  return {
    ref,
    waitlist: /\*?Waitlist request/i.test(text),
    departureCode: /\(([A-Z0-9]+-\d{6})\)/.exec(line('Departure'))?.[1] ?? '',
    optionId: travel?.[1] ?? '',
    travellers: travel ? Number(travel[2]) : people.length,
    addOnLabels,
    people,
    lead,
    notes: line('Notes'),
  };
}
