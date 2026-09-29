import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';

import { ServiceOrdersComponent } from './service-orders.component';
import { ServiceOrderService } from '../data-access/service-order.service';
import { AuthService } from '../../../core/services/auth.service';

describe('ServiceOrdersComponent — filtre multi-statuts', () => {
  function build() {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ServiceOrderService, useValue: { getServiceOrders: () => EMPTY, getSummary: () => EMPTY, getFilters: () => EMPTY } },
        { provide: AuthService, useValue: { hasPermission: () => true, hasRole: () => true } },
        { provide: ActivatedRoute, useValue: { queryParamMap: EMPTY } },
      ],
    });

    return TestBed.createComponent(ServiceOrdersComponent).componentInstance;
  }

  it('hides cancelled orders when no status is ticked', () => {
    const filters = build().buildFilters();

    expect(filters['status']).toBeUndefined();
    expect(filters['exclude_status']).toBe('ANNULE');
  });

  it('sends the ticked statuses joined by commas, cancelled ones included', () => {
    const component = build();
    component.filterStatuses.set(['TERMINE', 'ANNULE']);

    const filters = component.buildFilters();

    expect(filters['status']).toBe('TERMINE,ANNULE');
    expect(filters['exclude_status']).toBeUndefined();
  });

  it('sends the ticked payment statuses and methods joined by commas, only when ticked', () => {
    const component = build();
    expect(component.buildFilters()['payment_status']).toBeUndefined();
    expect(component.buildFilters()['payment_method']).toBeUndefined();

    component.filterPaymentStatuses.set(['NON PAYE', 'PARTIEL']);
    component.filterPaymentMethods.set(['Espèces', 'Effet']);

    expect(component.buildFilters()['payment_status']).toBe('NON PAYE,PARTIEL');
    expect(component.buildFilters()['payment_method']).toBe('Espèces,Effet');
  });

  it('offers « Effet » among the payment methods', () => {
    expect(build().paymentMethodOptions.map((o) => o.value)).toContain('Effet');
  });

  it('opens the « à facturer » bucket as finished and unpaid', () => {
    const component = build();
    component.viewBucketInList('a-facturer');

    const filters = component.buildFilters();
    expect(filters['status']).toBe('TERMINE');
    expect(filters['payment_status']).toBe('NON PAYE');
  });

  it('names each ticked status among the active filters', () => {
    const component = build();
    component.filterStatuses.set(['EN COURS', 'ANNULE']);

    expect(component.activeFilters().map((f) => f.label)).toEqual(['statut en cours', 'statut annulée']);
  });
});
