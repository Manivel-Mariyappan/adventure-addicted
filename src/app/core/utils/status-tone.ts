import { BookingStatus } from '../models';

// colour of the status pill (see .pill in styles.scss)
export const STATUS_TONE: Record<BookingStatus, 'info' | 'good' | 'warn' | 'bad' | 'muted'> = {
  Requested: 'info',
  'Pending payment': 'warn',
  Confirmed: 'good',
  Waitlisted: 'warn',
  Cancelled: 'bad',
  'Refund pending': 'warn',
  Completed: 'muted',
};
