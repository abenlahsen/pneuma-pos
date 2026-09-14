import { signal } from '@angular/core';
import type { Mock } from 'vitest';
import { DetailNavigator, isTypingTarget } from './detail-navigator';

interface Row { id: number }

function rows(...ids: number[]): Row[] {
  return ids.map(id => ({ id }));
}

describe('DetailNavigator', () => {
  let items: ReturnType<typeof signal<Row[]>>;
  let current: ReturnType<typeof signal<Row | null>>;
  let page: ReturnType<typeof signal<number>>;
  let lastPage: ReturnType<typeof signal<number>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let goToPage: Mock<(page: number) => void>;
  let nav: DetailNavigator<Row>;

  beforeEach(() => {
    items = signal<Row[]>(rows(1, 2, 3));
    current = signal<Row | null>(null);
    page = signal(1);
    lastPage = signal(2);
    loading = signal(false);
    goToPage = vi.fn<(page: number) => void>((p) => page.set(p));
    nav = new DetailNavigator<Row>({
      items, current, page, lastPage, loading,
      perPage: signal(3),
      total: signal(5),
      goToPage,
    });
  });

  describe('index / position', () => {
    it('locates the open record in the current page and builds a global position', () => {
      current.set(items()[1]);
      expect(nav.index()).toBe(1);
      expect(nav.position()).toBe('2 / 5');

      page.set(2);
      expect(nav.position()).toBe('5 / 5');
    });

    it('is -1 with no position when the record is not in the list (deep link) or the modal is closed', () => {
      expect(nav.index()).toBe(-1);
      expect(nav.position()).toBeNull();

      current.set({ id: 99 });
      expect(nav.index()).toBe(-1);
      expect(nav.hasPrev()).toBe(false);
      expect(nav.hasNext()).toBe(false);
    });
  });

  describe('hasPrev / hasNext', () => {
    it('are both true in the middle of a page', () => {
      current.set(items()[1]);
      expect(nav.hasPrev()).toBe(true);
      expect(nav.hasNext()).toBe(true);
    });

    it('hasPrev is false on the very first record, true on the first row of a later page', () => {
      current.set(items()[0]);
      expect(nav.hasPrev()).toBe(false);
      page.set(2);
      expect(nav.hasPrev()).toBe(true);
    });

    it('hasNext is true on the last row when more pages exist, false on the very last record', () => {
      current.set(items()[2]);
      expect(nav.hasNext()).toBe(true);
      page.set(2);
      expect(nav.hasNext()).toBe(false);
    });

    it('are both false while the list is loading', () => {
      current.set(items()[1]);
      loading.set(true);
      expect(nav.hasPrev()).toBe(false);
      expect(nav.hasNext()).toBe(false);
    });
  });

  describe('next / prev within a page', () => {
    it('swaps the current record without reloading', () => {
      current.set(items()[0]);
      nav.next();
      expect(current()).toEqual({ id: 2 });
      nav.prev();
      expect(current()).toEqual({ id: 1 });
      expect(goToPage).not.toHaveBeenCalled();
    });

    it('does nothing at the edges when no other page exists', () => {
      lastPage.set(1);
      current.set(items()[2]);
      nav.next();
      expect(current()).toEqual({ id: 3 });
      expect(goToPage).not.toHaveBeenCalled();
    });
  });

  describe('crossing page boundaries', () => {
    it('next on the last row loads the next page and opens its first row once loaded', () => {
      current.set(items()[2]);
      nav.next();

      expect(goToPage).toHaveBeenCalledWith(2);
      expect(current()).toEqual({ id: 3 }); // unchanged until the list arrives

      items.set(rows(4, 5));
      nav.onListLoaded();
      expect(current()).toEqual({ id: 4 });
      expect(nav.position()).toBe('4 / 5');
    });

    it('prev on the first row of page 2 loads page 1 and opens its last row', () => {
      page.set(2);
      items.set(rows(4, 5));
      current.set(items()[0]);
      nav.prev();

      expect(goToPage).toHaveBeenCalledWith(1);
      items.set(rows(1, 2, 3));
      nav.onListLoaded();
      expect(current()).toEqual({ id: 3 });
    });

    it('a plain reload (no pending edge) never changes the open record', () => {
      current.set(items()[1]);
      items.set(rows(7, 8, 9));
      nav.onListLoaded();
      expect(current()).toEqual({ id: 2 });
    });

    it('reset() cancels a pending edge (modal closed or reload failed)', () => {
      current.set(items()[2]);
      nav.next();
      nav.reset();
      items.set(rows(4, 5));
      nav.onListLoaded();
      expect(current()).toEqual({ id: 3 });
    });

    it('ignores the pending edge when the new page is empty', () => {
      current.set(items()[2]);
      nav.next();
      items.set([]);
      nav.onListLoaded();
      expect(current()).toEqual({ id: 3 });
    });
  });
});

/**
 * Liste affichée du plus récent au plus ancien (tri serveur par défaut :
 * date DESC, id DESC). « Suivant » doit alors mener à la commande de numéro
 * SUPÉRIEUR — la ligne du dessus — et non à la ligne du dessous : sur la
 * commande 11, Suivant ouvre la 12, Précédent la 10.
 */
describe('DetailNavigator — liste descendante (plus récent en premier)', () => {
  let items: ReturnType<typeof signal<Row[]>>;
  let current: ReturnType<typeof signal<Row | null>>;
  let page: ReturnType<typeof signal<number>>;
  let lastPage: ReturnType<typeof signal<number>>;
  let descending: ReturnType<typeof signal<boolean>>;
  let goToPage: Mock<(page: number) => void>;
  let nav: DetailNavigator<Row>;

  beforeEach(() => {
    // page 1 = 12, 11, 10 — page 2 = 9, 8
    items = signal<Row[]>(rows(12, 11, 10));
    current = signal<Row | null>(null);
    page = signal(1);
    lastPage = signal(2);
    descending = signal(true);
    goToPage = vi.fn<(page: number) => void>((p) => page.set(p));
    nav = new DetailNavigator<Row>({
      items, current, page, lastPage, descending,
      loading: signal(false),
      perPage: signal(3),
      total: signal(5),
      goToPage,
    });
  });

  it('Suivant ouvre le numéro supérieur, Précédent le numéro inférieur', () => {
    current.set({ id: 11 });
    nav.next();
    expect(current()).toEqual({ id: 12 });
    nav.prev();
    expect(current()).toEqual({ id: 11 });
    nav.prev();
    expect(current()).toEqual({ id: 10 });
    expect(goToPage).not.toHaveBeenCalled();
  });

  it('hasNext est faux sur le tout premier enregistrement (le plus récent), hasPrev sur le tout dernier', () => {
    current.set({ id: 12 });
    expect(nav.hasNext()).toBe(false);
    expect(nav.hasPrev()).toBe(true);

    page.set(2);
    items.set(rows(9, 8));
    current.set({ id: 8 });
    expect(nav.hasPrev()).toBe(false);
    expect(nav.hasNext()).toBe(true);
  });

  it('Précédent en bas de page charge la page suivante et ouvre sa première ligne', () => {
    current.set({ id: 10 });
    nav.prev();

    expect(goToPage).toHaveBeenCalledWith(2);
    expect(current()).toEqual({ id: 10 }); // inchangé tant que la liste n'est pas arrivée

    items.set(rows(9, 8));
    nav.onListLoaded();
    expect(current()).toEqual({ id: 9 });
  });

  it('Suivant en haut de page 2 charge la page 1 et ouvre sa dernière ligne', () => {
    page.set(2);
    items.set(rows(9, 8));
    current.set({ id: 9 });
    nav.next();

    expect(goToPage).toHaveBeenCalledWith(1);
    items.set(rows(12, 11, 10));
    nav.onListLoaded();
    expect(current()).toEqual({ id: 10 });
  });

  it("revient à l'ordre des lignes dès que la liste repasse en croissant", () => {
    descending.set(false);
    items.set(rows(10, 11, 12));
    current.set({ id: 11 });
    nav.next();
    expect(current()).toEqual({ id: 12 });
  });
});

describe('isTypingTarget', () => {
  it('is true for inputs, textareas, selects and contenteditable elements', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(document.createElement('select'))).toBe(true);
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true'); // jsdom does not reflect the contentEditable property
    document.body.appendChild(div);
    expect(isTypingTarget(div)).toBe(true);
    div.remove();
  });

  it('is false for buttons, plain elements and null', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
