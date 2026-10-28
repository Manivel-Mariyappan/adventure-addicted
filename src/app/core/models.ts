// Content published as JSON in public/data/. Bookings and other private records live in the
// admin (src/admin/core/admin-models.ts) and are never written to these files.

export interface Faq {
  question: string;
  answer: string;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  // e.g. Ladakh for Leh, Nubra and Pangong; null for a region
  parentId: string | null;
  region: string;
  summary: string;
  description: string;
  highlights: string[];
  bestSeason: string;
  altitudeM: number | null;
  image: string;
  gallery: string[];
  faqs: Faq[];
  featured: boolean;
  active: boolean;
  displayOrder: number;
  metaTitle: string;
  metaDescription: string;
}

export type Difficulty = 'Easy' | 'Moderate' | 'Challenging' | 'Extreme';
export type TravelType = 'bike' | 'own-car' | 'vehicle';
export type TourStatus = 'draft' | 'published' | 'archived';

// How a traveller joins the group: on one of our bikes, in their own car, or in our vehicle.
// Each option has its own price, seats and inclusions.
export interface TravelOption {
  id: string;
  type: TravelType;
  label: string;
  description: string;
  // per person
  price: number;
  includes: string[];
  // own-car tours: fuel, tolls, parking and so on
  customerPays: string[];
}

export type AddOnUnit = 'person' | 'booking';

export interface AddOn {
  id: string;
  label: string;
  price: number;
  unit: AddOnUnit;
}

export interface ItineraryDay {
  day: number;
  title: string;
  location: string;
  description: string;
  activities: string[];
  stay: string;
  meals: string;
  distanceKm: number | null;
  altitudeM: number | null;
}

// refundPercent applies when cancelling at least daysBefore days before departure
export interface PolicyRule {
  daysBefore: number;
  refundPercent: number;
}

export interface TourPackage {
  id: string;
  code: string;
  slug: string;
  name: string;
  tagline: string;
  destinationIds: string[];
  route: string[];
  summary: string;
  description: string;
  highlights: string[];
  coverImage: string;
  gallery: string[];
  days: number;
  nights: number;
  startLocation: string;
  endLocation: string;
  difficulty: Difficulty;
  maxAltitudeM: number | null;
  totalDistanceKm: number | null;
  flightsIncluded: boolean;
  accommodation: string;
  mealPlan: string;
  travelOptions: TravelOption[];
  addOns: AddOn[];
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  documents: string[];
  safety: string[];
  cancellationPolicy: PolicyRule[];
  faqs: Faq[];
  minParticipants: number;
  maxParticipants: number;
  status: TourStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DepartureStatus = 'scheduled' | 'cancelled' | 'completed';

export interface Departure {
  id: string;
  // what customers quote on WhatsApp, e.g. LDK8-270612
  code: string;
  tourId: string;
  startDate: string;
  endDate: string;
  totalSeats: number;
  // seats per travel option id; an option missing here isn't offered on this departure
  optionSeats: Record<string, number>;
  // departure prices per travel option id; missing = the tour price
  priceOverrides: Record<string, number>;
  // written by the admin on Publish, from its bookings
  seatsTaken: Record<string, number>;
  coordinatorId: string | null;
  bookingClosesOn: string;
  status: DepartureStatus;
}

export type CoordinatorGender = 'Male' | 'Female' | 'Other';

export interface Coordinator {
  id: string;
  name: string;
  gender: CoordinatorGender;
  // office contact only; not shown on the website
  email: string;
  phone: string;
  photo: string;
  bio: string;
  languages: string[];
  experienceYears: number;
  // SHA-256 of the coordinator portal PIN
  pinHash: string;
  active: boolean;
}

export interface Testimonial {
  name: string;
  city: string;
  tour: string;
  text: string;
}

export interface Office {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  hours: string;
  // what to search on Google Maps; empty = the address
  mapQuery: string;
}

export interface CompanySettings {
  companyName: string;
  // uploaded logo (data URL) or a path; empty uses the default favicon.svg
  logo?: string;
  tagline: string;
  // a few sentences about the company, shown on the About page
  description: string;
  whatsappNumber: string;
  phone: string;
  email: string;
  offices: Office[];
  officeHours: string;
  instagram: string;
  youtube: string;
  facebook: string;
  gstPercent: number;
  // % of the total paid upfront to confirm seats
  advancePercent: number;
  balanceDueDays: number;
  // unpaid requests keep their seats this long
  holdHours: number;
  testimonials: Testimonial[];
  faqs: Faq[];
}

export type BookingStatus =
  | 'Requested'
  | 'Pending payment'
  | 'Confirmed'
  | 'Waitlisted'
  | 'Cancelled'
  | 'Refund pending'
  | 'Completed';

// booking-status.json, looked up by reference on My trips. No names or phone numbers.
export interface BookingStatusEntry {
  ref: string;
  status: BookingStatus;
  total: number;
  paid: number;
  updatedAt: string;
}
