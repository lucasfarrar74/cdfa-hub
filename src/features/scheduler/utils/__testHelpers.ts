import type { Supplier, Buyer, Meeting, TimeSlot, MeetingStatus } from '../types';

export function makeSupplier(overrides: Partial<Supplier> = {}): Supplier {
  return {
    id: overrides.id ?? 's1',
    companyName: overrides.companyName ?? 'Acme Corp',
    primaryContact: overrides.primaryContact ?? { name: 'Alice' },
    meetingDuration: overrides.meetingDuration ?? 30,
    preference: overrides.preference ?? 'all',
    preferenceList: overrides.preferenceList ?? [],
    ...overrides,
  };
}

export function makeBuyer(id: string, overrides: Partial<Buyer> = {}): Buyer {
  return {
    id,
    name: overrides.name ?? `Buyer ${id}`,
    organization: overrides.organization ?? 'Org',
    ...overrides,
  };
}

export function makeSlot(
  id: string,
  date: string,
  hours: number,
  minutes: number,
  durationMin: number = 30,
): TimeSlot {
  const start = new Date(2024, 0, 1, hours, minutes, 0);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return {
    id,
    date,
    startTime: start,
    endTime: end,
    isBreak: false,
  };
}

export function makeMeeting(
  id: string,
  supplierId: string,
  buyerId: string,
  timeSlotId: string,
  status: MeetingStatus = 'scheduled',
): Meeting {
  return { id, supplierId, buyerId, timeSlotId, status };
}
