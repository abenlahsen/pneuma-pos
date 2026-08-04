import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';

import { PurchaseFormComponent } from './purchase-form.component';
import { PurchaseService } from '../../../core/services/purchase.service';
import { ProductService } from '../../../core/services/product.service';
import { SupplierService } from '../../suppliers/data-access/supplier.service';
import { StockService } from '../../../core/services/stock.service';

const purchaseServiceStub = {};
const productServiceStub = { getProducts: () => of({ data: [] }) };
const supplierServiceStub = { getSuppliers: () => of({ data: [] }) };
const stockServiceStub = { getStocks: () => of({ data: [] }) };

describe('PurchaseFormComponent', () => {
  let comp: PurchaseFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PurchaseFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PurchaseService, useValue: purchaseServiceStub },
        { provide: ProductService, useValue: productServiceStub },
        { provide: SupplierService, useValue: supplierServiceStub },
        { provide: StockService, useValue: stockServiceStub },
      ],
    }).compileComponents();

    comp = TestBed.createComponent(PurchaseFormComponent).componentInstance;
  });

  describe('statusOptions', () => {
    it('defaults to EN COURS transitions when formData.status is unset', () => {
      expect(comp.statusOptions).toEqual(['EN COURS', 'RECU', 'ANNULE']);
    });

    it('lists RECU transitions with RECU kept first', () => {
      comp.formData.status = 'RECU';
      expect(comp.statusOptions).toEqual(['RECU', 'EN COURS', 'TERMINE']);
    });

    it('treats ANNULE as a dead end: only EN COURS is offered', () => {
      comp.formData.status = 'ANNULE';
      expect(comp.statusOptions).toEqual(['ANNULE', 'EN COURS']);
    });

    it('restricts TERMINE to going back to RECU only', () => {
      comp.formData.status = 'TERMINE';
      expect(comp.statusOptions).toEqual(['TERMINE', 'RECU']);
    });
  });
});
