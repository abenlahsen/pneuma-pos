import { DAY_END_MIN, DAY_START_MIN, minutesOf, positionOf } from './workshop-planning.component';

/**
 * `3f` demande que la position d'une carte encode l'heure, et qu'une seule
 * fonction du temps serve aux cartes ET au trait de l'heure courante. Ces
 * tests protegent cette regle : si quelqu'un remet des hauteurs ecrites a la
 * main, ils tombent.
 */
describe('Planning atelier — la fonction du temps', () => {
  it('colle 09:00 en haut et 17:00 en bas', () => {
    expect(positionOf(DAY_START_MIN, 0).top).toBe(0);
    expect(positionOf(DAY_END_MIN, 0).top).toBe(100);
  });

  it('place 13:00 a la moitie de l’axe', () => {
    // 09:00 → 17:00 fait huit heures ; 13:00 en est le milieu exact.
    expect(positionOf(13 * 60, 0).top).toBe(50);
  });

  it('donne a une heure de travail un huitieme de la hauteur', () => {
    expect(positionOf(10 * 60, 60).height).toBe(12.5);
  });

  it('fait tenir une carte de deux heures sur un quart', () => {
    const { top, height } = positionOf(11 * 60, 120);

    expect(top).toBe(25);
    expect(height).toBe(25);
  });

  // Une carte qui deborde de l'amplitude serait tracee hors de sa colonne.
  it('ne laisse pas une carte deborder du bas', () => {
    const { top, height } = positionOf(16 * 60, 180);

    expect(top).toBe(87.5);
    expect(top + height).toBeLessThanOrEqual(100);
  });

  it('lit l’heure sans passer par Date', () => {
    // Passer par `new Date()` reinterpreterait l'heure d'atelier en UTC.
    expect(minutesOf('2026-09-14 09:30')).toBe(570);
    expect(minutesOf('2026-09-14 16:45')).toBe(1005);
    expect(minutesOf(null)).toBeNull();
    expect(minutesOf('pas une heure')).toBeNull();
  });
});
