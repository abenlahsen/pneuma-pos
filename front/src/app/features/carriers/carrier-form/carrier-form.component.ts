import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Carrier, CarrierPayload } from '../../../core/models/carrier.model';

@Component({
  selector: 'app-carrier-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './carrier-form.component.html',
  styleUrl: './carrier-form.component.scss'
})
export class CarrierFormComponent implements OnInit {
  @Input() carrier: Carrier | null = null;
  @Output() save = new EventEmitter<CarrierPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: CarrierPayload = { name: '', phone: '', email: '' };

  ngOnInit() {
    if (this.carrier) this.formData = { ...this.carrier };
  }

  onSubmit() { this.save.emit(this.formData); }
}
