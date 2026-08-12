import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { Client, ClientPayload } from '../../features/clients/models/client.model';
import { ClientService } from '../../features/clients/data-access/client.service';
import { CityService } from '../../core/services/city.service';

@Component({
  selector: 'app-quick-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-client-form.component.html',
  styleUrl: './quick-client-form.component.scss',
})
export class QuickClientFormComponent implements OnInit {
  @Input() initialName = '';
  @Output() clientCreated = new EventEmitter<Client>();
  @Output() cancelled = new EventEmitter<void>();

  private clientService = inject(ClientService);
  private cityService = inject(CityService);

  cities = signal<string[]>([]);
  saving = signal(false);
  fieldErrors = signal<Record<string, string[]>>({});
  generalError = signal<string | null>(null);
  duplicateMatches = signal<Client[]>([]);

  client: ClientPayload = {
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    category: 'Particulier',
    notes: '',
    is_active: true,
  };

  readonly categoryOptions = ['Particulier', 'Entreprise'];

  ngOnInit(): void {
    this.client = { ...this.client, name: this.initialName };
    this.cityService.getCities().subscribe(c => this.cities.set(c));
  }

  onPhoneBlur(): void {
    this.checkDuplicates();
  }

  onNameBlur(): void {
    this.checkDuplicates();
  }

  private checkDuplicates(): void {
    const name = this.client.name?.trim();
    const phone = this.client.phone?.trim();

    if (!name && !phone) {
      this.duplicateMatches.set([]);
      return;
    }

    this.clientService.checkDuplicates(name, phone).subscribe(res => {
      this.duplicateMatches.set(res.matches ?? []);
    });
  }

  useExistingClient(client: Client): void {
    this.clientCreated.emit(client);
  }

  save(): void {
    if (!this.client.name?.trim()) return;
    this.saving.set(true);
    this.fieldErrors.set({});
    this.generalError.set(null);

    this.clientService.createClient({ ...this.client, is_active: true }).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (created) => this.clientCreated.emit(created),
      error: (err) => {
        const errors: Record<string, string[]> = err?.error?.errors ?? {};

        if (Object.keys(errors).length) {
          this.fieldErrors.set(errors);

          if (errors['phone']?.length) {
            this.checkDuplicates();
          }
        } else {
          this.generalError.set(
            err?.error?.message || 'Erreur lors de la création rapide du client.'
          );
        }
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
