import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of, throwError } from 'rxjs';

import { PurchaseReceiveComponent, receptionLines } from './purchase-receive.component';
import { PurchaseService } from '../data-access/purchase.service';
import { Purchase } from '../models/purchase.model';

/**
 * Le stock n'entre qu'à la réception — la confirmation : ce qui entre, où,
 * à quelle date, et ce qui part à l'API.
 */
function purchase(over: Partial<Purchase> = {}): Purchase {
  return {
    id: 1031,
    date: '2026-09-15',
    with_invoice: true,
    status: 'EN COURS',
    payment_status: 'NON PAYE',
    stock_applied: false,
    supplier: { id: 3, name: 'Continental Distribution' } as any,
    items: [
      {
        id: 1, product_id: 7, stock_id: 31, quantity: 4, unit_price: 800,
        linked_product: { type: 'tyre', reference: 'R1', profile: 'Primacy 4', brand: { name: 'Michelin' }, tyre: { tire_width: 205, tire_height: 55, tire_diameter: 16 } } as any,
        stock: { id: 31, depot: 'Casablanca', zone: 'A-12', dot: '2425', quantity: 10 } as any,
      },
      {
        id: 2, product_id: 8, stock_id: 32, quantity: 2, unit_price: 900,
        linked_product: { type: 'tyre', reference: 'R2', profile: 'Alpin 6', brand: { name: 'Michelin' }, tyre: { tire_width: 195, tire_height: 65, tire_diameter: 15 } } as any,
        stock: { id: 32, depot: null, zone: null, dot: null, quantity: 0 } as any,
      },
    ],
    ...over,
  } as Purchase;
}

describe('receptionLines', () => {
  it('dit pour chaque ligne l\'article, le dépôt de réception et la quantité', () => {
    const lines = receptionLines(purchase());
    expect(lines[0]).toEqual(expect.objectContaining({
      name: 'Michelin Primacy 4', dimension: '205/55R16', depot: 'Casablanca · A-12 · DOT 2425', quantity: 4, before: 10,
    }));
    expect(lines[1].depot).toBe('Sans dépôt');
  });
});

describe('PurchaseReceiveComponent', () => {
  let comp: PurchaseReceiveComponent;
  let service: { getPurchase: ReturnType<typeof vi.fn>; receive: ReturnType<typeof vi.fn> };

  function create(p: Purchase = purchase()) {
    service = { getPurchase: vi.fn(() => of(p)), receive: vi.fn(() => of({ ...p, status: 'RECU' })) };
    TestBed.configureTestingModule({
      imports: [PurchaseReceiveComponent],
      providers: [provideZonelessChangeDetection(), { provide: PurchaseService, useValue: service }],
    });
    const fixture = TestBed.createComponent(PurchaseReceiveComponent);
    fixture.componentRef.setInput('purchaseId', 1031);
    comp = fixture.componentInstance;
    comp.ngOnInit();
  }

  it('chiffre la conséquence avant le bouton', () => {
    create();
    expect(comp.consequence()).toBe('6 pneus entrent en stock.');
  });

  it('prévient qu\'un achat d\'avant la règle est déjà compté en stock', () => {
    create(purchase({ stock_applied: true }));
    expect(comp.consequence()).toBe('6 pneus déjà comptés en stock : la réception ne change que le statut.');
  });

  it('part de la date du jour, modifiable, jamais future', () => {
    create();
    expect(comp.date()).toBe(comp.maxDate);
    comp.date.set('2026-09-20');
    expect(comp.dateInvalid()).toBe(false);
    comp.date.set('2999-01-01');
    expect(comp.dateInvalid()).toBe(true);
    comp.confirm();
    expect(service.receive).not.toHaveBeenCalled();
  });

  it('envoie la date choisie et rend l\'achat reçu', () => {
    create();
    const received: Purchase[] = [];
    comp.received.subscribe(p => received.push(p));
    comp.date.set('2026-09-20');
    comp.confirm();
    expect(service.receive).toHaveBeenCalledWith(1031, '2026-09-20');
    expect(received[0].status).toBe('RECU');
  });

  it('affiche le refus de l\'API, sans fermer', () => {
    create();
    service.receive.mockReturnValue(throwError(() => ({ error: { errors: { status: ['Cet achat est déjà reçu.'] } } })));
    const received: Purchase[] = [];
    comp.received.subscribe(p => received.push(p));
    comp.confirm();
    expect(comp.error()).toBe('Cet achat est déjà reçu.');
    expect(comp.submitting()).toBe(false);
    expect(received).toHaveLength(0);
  });
});
