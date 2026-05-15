import {
  Component, Input, Output, EventEmitter, OnInit,
  signal, computed, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../features/vehicles/data-access/vehicle.service';
import { Vehicle, VehiclePayload } from '../../features/vehicles/models/vehicle.model';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.scss',
})
export class VehicleFormComponent implements OnInit {
  @Input() vehicle: Vehicle | null = null;
  @Input({ required: true }) clientId!: number;
  @Output() saved = new EventEmitter<Vehicle>();
  @Output() cancelled = new EventEmitter<void>();

  private vehicleService = inject(VehicleService);

  plate = signal('');
  brand = signal('');
  modelName = signal('');
  circulationMonth = signal<number | null>(null);
  circulationYear = signal<number | null>(null);
  vin = signal('');
  notes = signal('');
  saving = signal(false);

  readonly PLATE_REGEX = /^\d{1,5}-[A-Za-z]{1,3}-\d{2,4}$/;

  readonly months = [
    { value: 1, label: 'Janvier' }, { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' }, { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' }, { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' }, { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' }, { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' }, { value: 12, label: 'Décembre' },
  ];

  readonly years = Array.from(
    { length: new Date().getFullYear() - 1969 },
    (_, i) => new Date().getFullYear() - i
  );

  readonly plateInvalid = computed(() => {
    const p = this.plate().trim();
    return p.length > 0 && !this.PLATE_REGEX.test(p);
  });

  readonly isValid = computed(() =>
    this.plate().trim().length > 0 &&
    !this.plateInvalid() &&
    this.brand().trim().length > 0 &&
    this.modelName().trim().length > 0 &&
    this.circulationMonth() !== null &&
    this.circulationYear() !== null
  );

  ngOnInit(): void {
    if (this.vehicle) {
      this.plate.set(this.vehicle.plate);
      this.brand.set(this.vehicle.brand);
      this.modelName.set(this.vehicle.model_name);
      this.circulationMonth.set(this.vehicle.circulation_month);
      this.circulationYear.set(this.vehicle.circulation_year);
      this.vin.set(this.vehicle.vin ?? '');
      this.notes.set(this.vehicle.notes ?? '');
    }
  }

  onSubmit(): void {
    if (!this.isValid() || this.saving()) return;

    const payload: VehiclePayload = {
      plate: this.plate().trim().toUpperCase(),
      brand: this.brand().trim(),
      model_name: this.modelName().trim(),
      circulation_month: this.circulationMonth()!,
      circulation_year: this.circulationYear()!,
      vin: this.vin().trim() || null,
      notes: this.notes().trim() || null,
    };

    this.saving.set(true);
    const request$ = this.vehicle
      ? this.vehicleService.updateVehicle(this.vehicle.id, payload)
      : this.vehicleService.createVehicle(this.clientId, payload);

    request$.subscribe({
      next: (v) => { this.saving.set(false); this.saved.emit(v); },
      error: () => this.saving.set(false),
    });
  }
}
