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

  client: ClientPayload = {
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    category: null,
    notes: '',
    is_active: true,
  };

  readonly categoryOptions = ['Particulier', 'Entreprise'];

  ngOnInit(): void {
    this.client = { ...this.client, name: this.initialName };
    this.cityService.getCities().subscribe(c => this.cities.set(c));
  }

  save(): void {
    if (!this.client.name?.trim()) return;
    this.saving.set(true);
    this.clientService.createClient({ ...this.client, is_active: true }).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: (created) => this.clientCreated.emit(created),
      error: (err) => {
        const errors: Record<string, string[]> = err?.error?.errors ?? {};
        const messages = Object.values(errors).flat();
        const detail = messages.length ? '\n' + messages.join('\n') : '';
        alert('Erreur lors de la création rapide du client.' + detail);
      },
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }
}
