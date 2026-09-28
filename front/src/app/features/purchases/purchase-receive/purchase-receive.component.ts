import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PurchaseService } from '../data-access/purchase.service';
import { BusinessDateService } from '../../../core/services/business-date.service';
import { Purchase, PurchaseItem } from '../models/purchase.model';

/** Une ligne de la confirmation : ce qui entre, et où. */
export interface ReceptionLine {
  id: number;
  name: string;
  dimension: string;
  /** « Casablanca · A-12 · DOT 2425 », ou « Sans dépôt ». */
  depot: string;
  quantity: number;
  /** Ce que le lot contient avant la réception. */
  before: number;
  isTyre: boolean;
}

/** Les lignes d'un achat, telles que la réception les fera entrer. */
export function receptionLines(purchase: Purchase): ReceptionLine[] {
  return (purchase.items ?? []).map((item: PurchaseItem, i) => {
    const product: any = item.linkedProduct || item.linked_product;
    const isTyre = product?.type === 'tyre';
    const name = product
      ? (isTyre ? [product.brand?.name, product.profile].filter(Boolean).join(' ') : '') || product.reference || `Produit #${item.product_id}`
      : `Produit #${item.product_id}`;
    const t = product?.tyre;
    const dimension = isTyre && t?.tire_width && t?.tire_height && t?.tire_diameter
      ? `${t.tire_width}/${t.tire_height}R${t.tire_diameter}`
      : '';
    const lot: any = item.stock;
    const depot = lot
      ? [lot.depot || 'Sans dépôt', lot.zone, lot.dot ? `DOT ${lot.dot}` : null].filter(Boolean).join(' · ')
      : 'Dépôt inconnu';
    return {
      id: item.id ?? i,
      name,
      dimension,
      depot,
      quantity: Number(item.quantity) || 0,
      before: Number(lot?.quantity ?? 0),
      isTyre,
    };
  });
}

/** Le jour selon le navigateur — seulement si le serveur ne répond pas. */
function browserToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * La confirmation de réception — le stock n'entre qu'à la réception.
 *
 * Même boîte que la confirmation 15c, mais le geste n'est pas destructeur :
 * « Réceptionner » est l'action solide. La conséquence est chiffrée avant le
 * bouton (« 6 pneus entrent en stock »), puis chaque ligne dit sa quantité et
 * son dépôt de réception. La date est celle du jour au Maroc, modifiable,
 * jamais future — lue sur le serveur (GET /api/business-date) : le navigateur
 * peut se tromper d'une heure sur le fuseau du Maroc et proposer demain entre
 * minuit et 1 h, date que le serveur refuserait.
 */
@Component({
  selector: 'app-purchase-receive',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './purchase-receive.component.html',
  styleUrl: './purchase-receive.component.scss',
})
export class PurchaseReceiveComponent implements OnInit {
  private readonly service = inject(PurchaseService);
  private readonly businessDate = inject(BusinessDateService);

  readonly purchaseId = input.required<number>();
  /** L'achat réceptionné, relu par l'API. */
  readonly received = output<Purchase>();
  readonly cancel = output<void>();

  readonly purchase = signal<Purchase | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  /** Aujourd'hui au Maroc : la date proposée et la borne. */
  readonly maxDate = signal(browserToday());
  readonly date = signal(browserToday());

  readonly lines = computed(() => {
    const p = this.purchase();
    return p ? receptionLines(p) : [];
  });

  readonly totalQuantity = computed(() => this.lines().reduce((sum, l) => sum + l.quantity, 0));

  /** « 6 pneus entrent en stock » ; « articles » dès qu'une ligne n'est pas un pneu. */
  readonly consequence = computed(() => {
    const n = this.totalQuantity();
    const noun = this.lines().length > 0 && this.lines().every(l => l.isTyre) ? 'pneu' : 'article';
    const plural = n > 1 ? 's' : '';
    if (this.purchase()?.stock_applied) {
      return `${n} ${noun}${plural} déjà compté${plural} en stock : la réception ne change que le statut.`;
    }
    return `${n} ${noun}${plural} ${n > 1 ? 'entrent' : 'entre'} en stock.`;
  });

  readonly dateInvalid = computed(() => !this.date() || this.date() > this.maxDate());

  ngOnInit(): void {
    forkJoin({
      purchase: this.service.getPurchase(this.purchaseId()),
      // Sans réponse du serveur, le jour du navigateur ; le serveur tranchera.
      today: this.businessDate.get().pipe(map(d => d.date), catchError(() => of(browserToday()))),
    }).subscribe({
      next: ({ purchase, today }) => {
        this.maxDate.set(today);
        this.date.set(today);
        this.purchase.set(purchase);
        this.loading.set(false);
      },
      error: () => {
        this.error.set("L'achat n'a pas pu être chargé.");
        this.loading.set(false);
      },
    });
  }

  confirm(): void {
    if (this.submitting() || this.dateInvalid() || !this.purchase()) return;
    this.submitting.set(true);
    this.error.set('');
    this.service.receive(this.purchaseId(), this.date()).subscribe({
      next: (p) => {
        this.submitting.set(false);
        this.received.emit(p);
      },
      error: (err) => {
        this.submitting.set(false);
        const errors = err?.error?.errors;
        this.error.set(errors ? Object.values(errors).flat().join(' ') : (err?.error?.message ?? "La réception n'a pas pu être enregistrée."));
      },
    });
  }
}
