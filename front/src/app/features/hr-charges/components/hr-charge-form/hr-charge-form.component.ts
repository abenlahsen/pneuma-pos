import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HrChargeBatchPayload, HrChargeFilters } from '../../models/hr-charge.model';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-hr-charge-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-charge-form.component.html',
  styleUrl: './hr-charge-form.component.scss',
})
export class HrChargeFormComponent implements OnChanges {
  @Input() filters: HrChargeFilters = { employees: [], subcategories: [], accounts: [] };
  @Input() defaultDate = new Date().toISOString().slice(0, 10);
  @Output() submitted = new EventEmitter<HrChargeBatchPayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly methods = PAYMENT_METHODS;

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      lines: this.fb.array([]),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultDate'] && this.lines.length === 0) {
      this.addLine();
    }
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  lineGroup(index: number): FormGroup {
    return this.lines.at(index) as FormGroup;
  }

  addLine(): void {
    this.lines.push(
      this.fb.group({
        employee_id: [null, [Validators.required]],
        date: [this.defaultDate, [Validators.required]],
        subcategory: ['', [Validators.required]],
        amount: [null, [Validators.required, Validators.min(0.01)]],
        account_id: [this.filters.accounts[0]?.id ?? null, [Validators.required]],
        method: ['Virement', [Validators.required]],
        description: [''],
      }),
    );
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  // Pre-fills the amount from the employee's base salary when the
  // subcategory picked is "Salaires" and the field is still empty — a
  // convenience for the common case, never overwrites a value already typed.
  onEmployeeChange(index: number): void {
    const group = this.lineGroup(index);
    const employee = this.filters.employees.find((e) => e.id === group.get('employee_id')?.value);
    const isSalary = (group.get('subcategory')?.value || '').toLowerCase().startsWith('salaire');
    if (employee?.salary && isSalary && !group.get('amount')?.value) {
      group.get('amount')?.setValue(employee.salary);
    }
  }

  totalAmount(): number {
    return this.lines.controls.reduce((sum, ctrl) => sum + (Number(ctrl.get('amount')?.value) || 0), 0);
  }

  onSubmit(): void {
    if (this.form.invalid || this.lines.length === 0) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit({ lines: this.form.value.lines });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
