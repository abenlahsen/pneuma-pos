import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PurchaseService } from '../../../../core/services/purchase.service';
import { PurchasePaymentDetail } from '../../../../core/models/purchase.model';
import { IconComponent } from '../../../../shared/icon/icon.component';

import { StateBadgeComponent } from '../../../../shared/state-badge/state-badge.component';
import { paymentTone } from '../../../../shared/state-badge/state-tone';

@Component({
  selector: 'app-purchase-payment-detail',
  standalone: true,
  imports: [StateBadgeComponent, IconComponent, CommonModule],
  templateUrl: './purchase-payment-detail.component.html',
  styleUrl: './purchase-payment-detail.component.scss',
})
export class PurchasePaymentDetailComponent implements OnInit {
  readonly paymentTone = paymentTone;

  @Input() paymentId!: number;
  @Output() closed = new EventEmitter<void>();

  loading = signal(true);
  errorMessage = signal('');
  detail = signal<PurchasePaymentDetail | null>(null);

  constructor(
    private purchaseService: PurchaseService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.purchaseService.getPaymentDetail(this.paymentId).subscribe({
      next: (data) => {
        this.detail.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger le détail de ce paiement.');
        this.loading.set(false);
      },
    });
  }

  goToPurchase(purchaseId: number): void {
    this.router.navigate(['/achats'], { queryParams: { id: purchaseId } });
    this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
