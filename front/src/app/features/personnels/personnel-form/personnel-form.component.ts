import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Personnel, PersonnelPayload } from '../../../core/models/personnel.model';

@Component({
  selector: 'app-personnel-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './personnel-form.component.html',
  styleUrls: ['./personnel-form.component.scss']
})
export class PersonnelFormComponent implements OnInit {
  @Input() personnel: Personnel | null = null;
  @Output() save = new EventEmitter<PersonnelPayload>();
  @Output() cancel = new EventEmitter<void>();

  formData: PersonnelPayload = { name: '', role: 'Commercial', phone: '', email: '', commission_rate: undefined };

  ngOnInit() {
    if (this.personnel) this.formData = { ...this.personnel };
  }

  onSubmit() { this.save.emit(this.formData); }
}
