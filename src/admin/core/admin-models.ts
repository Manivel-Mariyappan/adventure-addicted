// Private records kept by the admin in localStorage (see LocalCollection). None of this is
// published to public/data/ except the seat counts and booking-status.json built from it.
import { BookingStatus } from '../../app/core/models';
import { LeadContact } from '../../app/core/utils/booking-message';
import { QuoteLine } from '../../app/core/utils/trip-rules';

export type AdminRole = 'Owner' | 'Operations';

export interface AdminUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  // profile image: an uploaded data URL or a path; may be missing on older saved users
  photo?: string;
  role: AdminRole;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
}

export interface Passenger {
  name: string;
  age: number | null;
  gender: '' | 'Male' | 'Female' | 'Other';
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  // diet, medical, riding experience
  notes: string;
  idChecked: boolean;
}

export type PaymentMethod = 'UPI' | 'Bank transfer' | 'Cash' | 'Card' | 'Other';

export interface PaymentEntry {
  id: string;
  date: string;
  kind: 'payment' | 'refund';
  amount: number;
  method: PaymentMethod;
  reference: string;
  note: string;
}

export type BookingSource = 'Website' | 'WhatsApp' | 'Phone call' | 'Walk-in';

export interface Booking {
  id: string;
  ref: string;
  createdAt: string;
  updatedAt: string;
  source: BookingSource;
  tourId: string;
  departureId: string;
  optionId: string;
  travellers: number;
  addOns: Record<string, number>;
  lead: LeadContact;
  passengers: Passenger[];
  notes: string;
  // price snapshot taken when the booking was made, so later price changes don't affect it
  priceLines: QuoteLine[];
  discount: number;
  discountNote: string;
  gst: number;
  total: number;
  status: BookingStatus;
  // unpaid requests keep their seats until then
  holdUntil: string | null;
  payments: PaymentEntry[];
  cancelReason: string;
  history: { at: string; text: string }[];
  demo: boolean;
}

export interface CostLine {
  id: string;
  label: string;
  category: CostCategory;
  amount: number;
}

export type CostCategory =
  'Hotels' | 'Transport' | 'Bikes' | 'Fuel' | 'Permits' | 'Meals' | 'Guide and staff' | 'Other';

// Operations for one departure: arrangements, the cost estimate and what the coordinator reported.
export interface DepartureOps {
  id: string;
  departureId: string;
  arrangements: string;
  internalNotes: string;
  estimatedCosts: CostLine[];
  report: TripReport | null;
  updatedAt: string;
}

// ---- files exchanged with the coordinator portal ----

export interface TripPackPassenger extends Passenger {
  key: string;
  bookingRef: string;
  option: string;
  leadPhone: string;
}

// What the office sends the coordinator before a departure (downloaded as a .json file).
export interface TripPack {
  kind: 'aac-trip-pack';
  version: 1;
  generatedAt: string;
  departureId: string;
  departureCode: string;
  tourName: string;
  startDate: string;
  endDate: string;
  arrangements: string;
  passengers: TripPackPassenger[];
}

export interface Incident {
  id: string;
  at: string;
  day: number;
  severity: 'Low' | 'Medium' | 'High';
  title: string;
  details: string;
}

export interface TripExpense {
  id: string;
  at: string;
  day: number;
  category: CostCategory;
  description: string;
  amount: number;
  paidBy: string;
}

export interface DailyReport {
  day: number;
  at: string;
  status: 'On plan' | 'Delayed' | 'Changed';
  summary: string;
}

export interface Announcement {
  id: string;
  at: string;
  text: string;
}

// What the coordinator sends back (also a .json file), imported on the departure page.
export interface TripReport {
  kind: 'aac-trip-report';
  version: 1;
  departureId: string;
  coordinatorId: string;
  generatedAt: string;
  // day number -> passenger keys present that day
  attendance: Record<number, string[]>;
  checkedIn: string[];
  announcements: Announcement[];
  incidents: Incident[];
  expenses: TripExpense[];
  dailyReports: DailyReport[];
  completedAt: string | null;
  finalSummary: string;
}
