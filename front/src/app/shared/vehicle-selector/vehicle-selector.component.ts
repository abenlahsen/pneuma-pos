import {
  Component, Input, Output, EventEmitter,
  OnChanges, SimpleChanges, signal, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../features/vehicles/data-access/vehicle.service';
import { Vehicle } from '../../features/vehicles/models/vehicle.model';
import { VehicleFormComponent } from '../vehicle-form/vehicle-form.component';

@Component({
  selector: 'app-vehicle-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleFormComponent],
  templateUrl: './vehicle-selector.component.html',
  styleUrl: './vehicle-selector.component.scss',
})
export class VehicleSelectorComponent implements OnChanges {
  @Input() clientId: number | null = null;
  @Input() required = false;
  @Input() selectedVehicleId: number | null = null;
  @Output() vehicleSelected = new EventEmitter<Vehicle | null>();
  @Output() vehicleCreated = new EventEmitter<Vehicle>();

  private vehicleService = inject(VehicleService);

  vehicles = signal<Vehicle[]>([]);
  selectedVehicle = signal<Vehicle | null>(null);
  loading = signal(false);
  showCreateForm = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['clientId']) {
      if (this.clientId) {
        this.loadVehicles();
      } else {
        this.vehicles.set([]);
        this.selectedVehicle.set(null);
        this.showCreateForm.set(false);
        this.vehicleSelected.emit(null);
      }
    }
    // Si selectedVehicleId change indépendamment (ex: reset externe)
    if (changes['selectedVehicleId'] && !changes['clientId'] && this.vehicles().length) {
      const found = this.vehicles().find(v => v.id === this.selectedVehicleId) ?? null;
      this.selectedVehicle.set(found);
    }
  }

  private loadVehicles(): void {
    if (!this.clientId) return;
    this.loading.set(true);
    this.vehicleService.getVehiclesForClient(this.clientId, true).subscribe({
      next: (list) => {
        this.vehicles.set(list);
        if (this.selectedVehicleId) {
          const found = list.find(v => v.id === this.selectedVehicleId) ?? null;
          this.selectedVehicle.set(found);
        } else if (list.length === 1) {
          this.onVehicleChange(list[0].id);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onVehicleChange(id: number | string | null): void {
    const numId = id ? Number(id) : null;
    const v = numId ? (this.vehicles().find(v => v.id === numId) ?? null) : null;
    this.selectedVehicle.set(v);
    this.vehicleSelected.emit(v);
  }

  onVehicleCreated(vehicle: Vehicle): void {
    this.vehicles.update(list => [...list, vehicle]);
    this.onVehicleChange(vehicle.id);
    this.showCreateForm.set(false);
    this.vehicleCreated.emit(vehicle);
  }

  clearVehicle(): void {
    this.selectedVehicle.set(null);
    this.vehicleSelected.emit(null);
  }

  formatVehicle(v: Vehicle): string {
    return this.vehicleService.formatDisplay(v);
  }
}
