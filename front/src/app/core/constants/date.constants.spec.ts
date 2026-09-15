import { dayLabel, isoWeekBounds, shiftDays, shortDayLabel, todayIso } from './date.constants';

describe('date.constants', () => {
  describe('todayIso', () => {
    it('returns the local day, never the UTC one', () => {
      // Une date locale tard le soir bascule au lendemain en UTC : c'est le
      // decalage qui ferait afficher « demain » au comptoir a 23 h.
      const iso = todayIso();
      const now = new Date();
      const expected = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');

      expect(iso).toBe(expected);
    });
  });

  describe('shiftDays', () => {
    it('steps one day forward and back', () => {
      expect(shiftDays('2026-09-15', 1)).toBe('2026-09-16');
      expect(shiftDays('2026-09-15', -1)).toBe('2026-09-14');
    });

    it('crosses a month boundary', () => {
      expect(shiftDays('2026-09-30', 1)).toBe('2026-10-01');
      expect(shiftDays('2026-10-01', -1)).toBe('2026-09-30');
    });

    it('crosses a year boundary', () => {
      expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
      expect(shiftDays('2027-01-01', -1)).toBe('2026-12-31');
    });

    it('handles February in a leap year', () => {
      expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29');
      expect(shiftDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('steps a whole week back', () => {
      expect(shiftDays('2026-09-15', -7)).toBe('2026-09-08');
    });
  });

  describe('isoWeekBounds', () => {
    // La semaine commence le lundi : un dimanche appartient a la semaine qui
    // vient de s'ecouler, pas a celle qui commence.
    it('returns Monday to Sunday for a midweek day', () => {
      // 2026-09-15 est un mardi.
      expect(isoWeekBounds('2026-09-15')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    });

    it('keeps a Monday as the start of its own week', () => {
      expect(isoWeekBounds('2026-09-14')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    });

    it('puts a Sunday at the end of the week that preceded it', () => {
      expect(isoWeekBounds('2026-09-13')).toEqual({ from: '2026-09-07', to: '2026-09-13' });
    });
  });

  describe('dayLabel', () => {
    it('names the weekday in French, lowercase, for a sentence', () => {
      expect(dayLabel('2026-09-13')).toBe('dimanche 13/09');
      expect(dayLabel('2026-09-15')).toBe('mardi 15/09');
    });
  });

  describe('shortDayLabel', () => {
    it('capitalises the weekday for a standalone line', () => {
      expect(shortDayLabel('2026-09-07')).toBe('Lundi 07/09');
    });
  });
});
