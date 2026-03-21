import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Partner, PartnerPayload } from '../../../core/models/partner.model';

@Component({
  selector: 'app-partner-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partner-form.component.html',
  styleUrl: './partner-form.component.scss'
})
export class PartnerFormComponent implements OnInit {
  @Input() partner: Partner | null = null;
  @Output() save = new EventEmitter<PartnerPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: PartnerPayload = {
    name: '',
    city: '',
    phone: '',
    montage_price: undefined,
    alignment_price: undefined
  };

  ngOnInit() {
    if (this.partner) this.formData = { ...this.partner };
  }

  onSubmit() { this.save.emit(this.formData); }
}
