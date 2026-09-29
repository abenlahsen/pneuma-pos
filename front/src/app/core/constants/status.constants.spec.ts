import { PAYMENT_STATUS_OPTIONS, paymentStatusTag } from './status.constants';

describe('paymentStatusTag', () => {
  it('shows an unpaid document as « IMPAYÉ »', () => {
    expect(paymentStatusTag('NON PAYE')).toBe('IMPAYÉ');
  });

  it('treats a missing status as unpaid, as the lists always did', () => {
    expect(paymentStatusTag(null)).toBe('IMPAYÉ');
    expect(paymentStatusTag(undefined)).toBe('IMPAYÉ');
    expect(paymentStatusTag('')).toBe('IMPAYÉ');
  });

  it('leaves the other statuses as they are', () => {
    expect(paymentStatusTag('PAYE')).toBe('PAYE');
    expect(paymentStatusTag('PARTIEL')).toBe('PARTIEL');
  });
});

describe('PAYMENT_STATUS_OPTIONS', () => {
  it('labels the unpaid pill « Impayé »', () => {
    expect(PAYMENT_STATUS_OPTIONS.find((o) => o.value === 'NON PAYE')?.label).toBe('Impayé');
  });
});
