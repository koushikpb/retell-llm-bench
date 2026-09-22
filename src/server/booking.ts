export interface BookingArgs { date: string; time: string }
export interface BookingResult { created: boolean; confirmation: string; key: string }

// Idempotent side effect: the same call id + the same arguments is a no-op (Retell best-practice page).
export class BookingStore {
  private readonly bookings = new Map<string, string>();

  static key(callId: string, args: BookingArgs): string {
    return `${callId}:${JSON.stringify([args.date, args.time])}`;
  }

  book(callId: string, args: BookingArgs): BookingResult {
    const key = BookingStore.key(callId, args);
    const existing = this.bookings.get(key);
    if (existing) return { created: false, confirmation: existing, key };
    const confirmation = `BSD-${String(this.bookings.size + 1).padStart(4, '0')}`;
    this.bookings.set(key, confirmation);
    return { created: true, confirmation, key };
  }

  get size(): number {
    return this.bookings.size;
  }
}
