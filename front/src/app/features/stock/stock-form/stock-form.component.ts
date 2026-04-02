import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Stock, StockPayload } from '../../../core/models/stock.model';

@Component({
  selector: 'app-stock-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-form.component.html',
  styleUrl: './stock-form.component.scss'
})
export class StockFormComponent implements OnInit {
  @Input() stock: Stock | null = null;
  @Output() save = new EventEmitter<StockPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: StockPayload = {
    brand: '',
    profile: '',
    dimension: '',
    ic: '',
    iv: '',
    rft: false,
    reinforced: false,
    marking: '',
    made_in: '',
    dot: '',
    depot: '',
    zone: '',
    quantity: 0,
    purchase_price: null,
    selling_price: null,
    special_price: null,
  };

  ngOnInit() {
    if (this.stock) {
      this.formData = {
        brand: this.stock.brand || '',
        profile: this.stock.profile || '',
        dimension: this.stock.dimension || '',
        ic: this.stock.ic || '',
        iv: this.stock.iv || '',
        rft: this.stock.rft,
        reinforced: this.stock.reinforced,
        marking: this.stock.marking || '',
        made_in: this.stock.made_in || '',
        dot: this.stock.dot || '',
        depot: this.stock.depot || '',
        zone: this.stock.zone || '',
        quantity: this.stock.quantity,
        purchase_price: this.stock.purchase_price,
        selling_price: this.stock.selling_price,
        special_price: this.stock.special_price,
      };
    }
  }

  onSubmit() {
    this.save.emit(this.formData);
  }
}
