import { Signal, WritableSignal, computed } from '@angular/core';

export interface DetailNavigatorDeps<T extends { id: number }> {
  /** Rows of the page currently displayed, in display order. */
  items: Signal<T[]>;
  /** Record currently open in the detail modal (null = modal closed). */
  current: WritableSignal<T | null>;
  page: Signal<number>;
  lastPage: Signal<number>;
  perPage: Signal<number>;
  total: Signal<number>;
  loading: Signal<boolean>;
  /** Triggers a reload of the list for the given page (the page's own `goToPage`). */
  goToPage: (page: number) => void;
  /**
   * True when the table shows the most recent record first (the server's
   * default: date DESC, id DESC — or an explicit descending sort). "Suivant"
   * then means the row ABOVE, so that on order 11 it opens order 12, not 10:
   * next/prev always step toward the higher/lower sort key, whichever way
   * the rows happen to be laid out. Omitted = rows are ascending.
   */
  descending?: Signal<boolean>;
}

/**
 * "Précédent / Suivant" navigation for a detail modal opened from a paginated,
 * server-sorted list. Steps through the rows of the loaded page and, at the
 * page edges, asks the parent to load the neighbouring page then opens its
 * last/first row once `onListLoaded()` is called — so the navigation follows
 * the exact order (filters + sort) of the table behind the modal.
 *
 * Pure signals, no DI: shared by the Sales and Purchases pages and unit-tested
 * on its own.
 */
export class DetailNavigator<T extends { id: number }> {
  private pendingEdge: 'first' | 'last' | null = null;

  /** Index of the open record in the current page, -1 when it is not in the list (e.g. deep link). */
  readonly index = computed(() => {
    const id = this.deps.current()?.id;
    return id == null ? -1 : this.deps.items().findIndex(item => item.id === id);
  });

  /** Rows are displayed newest-first: "next" walks UP the table. */
  private readonly reversed = computed(() => this.deps.descending?.() ?? false);

  private readonly hasRowBefore = computed(() => {
    const i = this.index();
    return i > 0 || (i === 0 && this.deps.page() > 1);
  });

  private readonly hasRowAfter = computed(() => {
    const i = this.index();
    return i >= 0 && (i < this.deps.items().length - 1 || this.deps.page() < this.deps.lastPage());
  });

  readonly hasPrev = computed(() => {
    if (this.deps.loading()) return false;
    return this.reversed() ? this.hasRowAfter() : this.hasRowBefore();
  });

  readonly hasNext = computed(() => {
    if (this.deps.loading()) return false;
    return this.reversed() ? this.hasRowBefore() : this.hasRowAfter();
  });

  /** "12 / 340" — global position in the filtered result, null when not navigable. */
  readonly position = computed(() => {
    const i = this.index();
    if (i < 0) return null;
    return `${(this.deps.page() - 1) * this.deps.perPage() + i + 1} / ${this.deps.total()}`;
  });

  constructor(private readonly deps: DetailNavigatorDeps<T>) {}

  prev(): void {
    if (!this.hasPrev()) return;
    if (this.reversed()) this.stepToRowAfter();
    else this.stepToRowBefore();
  }

  next(): void {
    if (!this.hasNext()) return;
    if (this.reversed()) this.stepToRowBefore();
    else this.stepToRowAfter();
  }

  /** Row above; on the first row, the last row of the previous page. */
  private stepToRowBefore(): void {
    const i = this.index();
    if (i > 0) {
      this.deps.current.set(this.deps.items()[i - 1]);
      return;
    }
    this.pendingEdge = 'last';
    this.deps.goToPage(this.deps.page() - 1);
  }

  /** Row below; on the last row, the first row of the next page. */
  private stepToRowAfter(): void {
    const i = this.index();
    if (i < this.deps.items().length - 1) {
      this.deps.current.set(this.deps.items()[i + 1]);
      return;
    }
    this.pendingEdge = 'first';
    this.deps.goToPage(this.deps.page() + 1);
  }

  /** Call after the list signal has been refreshed from the API. */
  onListLoaded(): void {
    const edge = this.pendingEdge;
    this.pendingEdge = null;
    if (!edge || !this.deps.current()) return;
    const items = this.deps.items();
    if (items.length === 0) return;
    this.deps.current.set(edge === 'first' ? items[0] : items[items.length - 1]);
  }

  /** Call when the list reload failed or the modal was closed. */
  reset(): void {
    this.pendingEdge = null;
  }
}

/** True when a keyboard event originates from a field where arrow keys must keep their native meaning. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  // `isContentEditable` is not implemented by every DOM (e.g. jsdom) — fall back to the attribute.
  return target.isContentEditable === true || target.getAttribute('contenteditable') === 'true';
}
