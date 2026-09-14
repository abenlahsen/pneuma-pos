import { paymentTone, statusTone } from './state-tone';

describe('state-tone', () => {
  describe('paymentTone', () => {
    it('reads a settled payment as neutral', () => {
      expect(paymentTone('PAYE')).toBe('neutral');
    });

    // Ce qui coute quelque chose passe en alerte : c'est ce qui fait ressortir
    // les cinq impayes d'une liste de trente-sept ventes.
    it('raises an alert on a partial or missing payment', () => {
      expect(paymentTone('PARTIEL')).toBe('alert');
      expect(paymentTone('NON PAYE')).toBe('alert');
    });

    it('accepts a lowercase value', () => {
      expect(paymentTone('paye')).toBe('neutral');
    });

    // Un statut absent n'est pas un impaye : on ne crie pas sur une inconnue.
    it('stays neutral when the status is missing or unknown', () => {
      expect(paymentTone(null)).toBe('neutral');
      expect(paymentTone(undefined)).toBe('neutral');
      expect(paymentTone('')).toBe('neutral');
      expect(paymentTone('BROUILLON')).toBe('neutral');
    });
  });

  describe('statusTone', () => {
    // Seule l'annulation merite l'alerte : le reste est un etat lu.
    it('raises an alert on a cancelled or refused record', () => {
      expect(statusTone('ANNULE')).toBe('alert');
      expect(statusTone('ANNULEE')).toBe('alert');
      expect(statusTone('REFUSEE')).toBe('alert');
    });

    it('reads every other status as neutral', () => {
      expect(statusTone('EN COURS')).toBe('neutral');
      expect(statusTone('LIVRE')).toBe('neutral');
      expect(statusTone('MONTE')).toBe('neutral');
      expect(statusTone('TERMINEE')).toBe('neutral');
      expect(statusTone('TERMINE')).toBe('neutral');
      expect(statusTone('RECU')).toBe('neutral');
      expect(statusTone('ACCEPTEE')).toBe('neutral');
      expect(statusTone(null)).toBe('neutral');
    });
  });
});
