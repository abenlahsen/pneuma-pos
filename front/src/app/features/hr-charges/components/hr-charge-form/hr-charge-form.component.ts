import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HrCharge, HrChargeBatchPayload, HrChargeFilters } from '../../models/hr-charge.model';

const PAYMENT_METHODS = ['Espèces', 'Chèque', 'Virement', 'Effet', 'Carte bancaire'];

@Component({
  selector: 'app-hr-charge-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hr-charge-form.component.html',
  styleUrl: './hr-charge-form.component.scss',
})
export class HrChargeFormComponent implements OnInit {
  @Input() filters: HrChargeFilters = { employees: [], subcategories: [], accounts: [] };
  @Input() defaultDate = new Date().toISOString().slice(0, 10);
  // When set, the form opens with a single line pre-filled from this charge
  // instead of a blank one — used for both "Modifier" (editMode=true) and
  // "Dupliquer" (editMode=false, date reset to defaultDate).
  @Input() charge: HrCharge | null = null;
  @Input() editMode = false;
  @Output() submitted = new EventEmitter<HrChargeBatchPayload>();
  @Output() cancelled = new EventEmitter<void>();

  readonly methods = PAYMENT_METHODS;

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      lines: this.fb.array([]),
    });
  }

  ngOnInit(): void {
    if (this.charge) {
      this.addLine(this.charge);
    } else {
      this.addLine();
    }
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  lineGroup(index: number): FormGroup {
    return this.lines.at(index) as FormGroup;
  }

  // The <select> elements bind with [value] rather than [ngValue], so the
  // ControlValueAccessor compares strings — a numeric id would leave the
  // select showing its placeholder option instead of the pre-filled value.
  addLine(source?: HrCharge): void {
    this.lines.push(
      this.fb.group({
        employee_id: [source ? String(source.employee_id ?? '') : null, [Validators.required]],
        date: [source && this.editMode ? source.date : this.defaultDate, [Validators.required]],
        subcategory: [source?.subcategory ?? '', [Validators.required]],
        amount: [source?.amount ?? null, [Validators.required, Validators.min(0.01)]],
        account_id: [
          source ? String(source.account?.id ?? '') : String(this.filters.accounts[0]?.id ?? ''),
          [Validators.required],
        ],
        method: [source?.method ?? 'Virement', [Validators.required]],
        description: [source ? source.description ?? '' : ''],
      }),
    );
  }

  removeLine(index: number): void {
    this.lines.removeAt(index);
  }

  // Pre-fills the amount from the employee's base salary when the
  // subcategory picked is "Salaire" and the field is still empty — a
  // convenience for the common case, never overwrites a value already typed.
  onEmployeeChange(index: number): void {
    const group = this.lineGroup(index);
    const employee = this.filters.employees.find((e) => String(e.id) === group.get('employee_id')?.value);
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
