import { describe, it, expect } from 'vitest';
import { isSlotInSupplierWindow, canSupplierMeetBuyer } from './scheduler';
import { makeSupplier, makeSlot } from './__testHelpers';

describe('isSlotInSupplierWindow', () => {
  it('returns true when supplier has no time window', () => {
    const supplier = makeSupplier();
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 8, 0), supplier)).toBe(true);
  });

  it('returns false for slots starting before availableFrom', () => {
    const supplier = makeSupplier({ availableFrom: '09:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 8, 30), supplier)).toBe(false);
  });

  it('returns true for slots starting exactly at availableFrom', () => {
    const supplier = makeSupplier({ availableFrom: '09:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 9, 0), supplier)).toBe(true);
  });

  it('treats availableTo as exclusive upper bound', () => {
    const supplier = makeSupplier({ availableTo: '12:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 12, 0), supplier)).toBe(false);
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 11, 30), supplier)).toBe(true);
  });

  it('accepts slots within a bounded window', () => {
    const supplier = makeSupplier({ availableFrom: '09:00', availableTo: '12:00' });
    expect(isSlotInSupplierWindow(makeSlot('s', '2024-01-01', 10, 30), supplier)).toBe(true);
  });
});

describe('canSupplierMeetBuyer', () => {
  it('returns true for all buyers when preference is "all"', () => {
    const supplier = makeSupplier({ preference: 'all', preferenceList: [] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(true);
  });

  it('returns true only for listed buyers when preference is "include"', () => {
    const supplier = makeSupplier({ preference: 'include', preferenceList: ['b1', 'b2'] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(true);
    expect(canSupplierMeetBuyer(supplier, 'b3')).toBe(false);
  });

  it('returns false for listed buyers when preference is "exclude"', () => {
    const supplier = makeSupplier({ preference: 'exclude', preferenceList: ['b1'] });
    expect(canSupplierMeetBuyer(supplier, 'b1')).toBe(false);
    expect(canSupplierMeetBuyer(supplier, 'b2')).toBe(true);
  });
});
