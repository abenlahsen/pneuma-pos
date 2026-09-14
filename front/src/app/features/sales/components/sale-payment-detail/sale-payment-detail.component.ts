import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../../../core/services/payment.service';
import { PaymentDetail } from '../../../../core/models/payment.model';
import { IconComponent } from '../../../../shared/icon/icon.component';

import { StateBadgeComponent } from '../../../../shared/state-badge/state-badge.component';
import { paymentTone } from '../../../../shared/state-badge/state-tone';

@Component({
  selector: 'app-sale-payment-detail',
  standalone: true,
  imports: [StateBadgeComponent, IconComponent, CommonModule],
  templateUrl: './sale-payment-detail.component.html',
  styleUrl: './sale-payment-detail.component.scss',
})
export class SalePaymentDetailComponent implements OnInit {
  readonly paymentTone = paymentTone;

  @Input() paymentId!: number;
  @Output() closed = new EventEmitter<void>();

  loading = signal(true);
  errorMessage = signal('');
  detail = signal<PaymentDetail | null>(null);

  constructor(
    private paymentService: PaymentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.paymentService.getPaymentDetail(this.paymentId).subscribe({
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

  goToSale(saleId: number): void {
    this.router.navigate(['/sales'], { queryParams: { id: saleId } });
    this.close();
  }

  close(): void {
    this.closed.emit();
  }
}
