import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesRep, SalesRepPayload } from '../../../core/models/sales-rep.model';

@Component({
  selector: 'app-sales-rep-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-rep-form.component.html',
  styleUrl: './sales-rep-form.component.scss'
})
export class SalesRepFormComponent implements OnInit {
  @Input() rep: SalesRep | null = null;
  @Output() save = new EventEmitter<SalesRepPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: SalesRepPayload = { name: '', phone: '', email: '', commission_rate: undefined };

  ngOnInit() {
    if (this.rep) this.formData = { ...this.rep };
  }

  onSubmit() { this.save.emit(this.formData); }
}
