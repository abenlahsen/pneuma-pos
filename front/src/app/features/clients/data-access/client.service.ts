import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Client,
  ClientDuplicateCheckResponse,
  ClientFilters,
  ClientListResponse,
  ClientPayload,
  ClientProfileResponse,
  ClientSalesHistoryRow,
  ClientStatementResponse,
  UnpaidSaleRow,
  ClientPaymentPayload,
} from '../models/client.model';

@Injectable({
  providedIn: 'root',
})
export class ClientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/clients`;

  getClients(filters: ClientFilters = {}): Observable<Client[]> {
    return this.http
      .get<Client[] | ClientListResponse>(this.apiUrl, { params: this.buildParams(filters) })
      .pipe(map((response) => this.extractListResponse(response).data));
  }

  getClientsResponse(filters: ClientFilters = {}): Observable<ClientListResponse> {
    return this.http
      .get<Client[] | ClientListResponse>(this.apiUrl, { params: this.buildParams(filters) })
      .pipe(map((response) => this.extractListResponse(response)));
  }

  getClient(id: number): Observable<Client> {
    return this.http.get<Client | { data?: Client }>(`${this.apiUrl}/${id}`).pipe(
      map((response) => {
        if ('data' in response && response.data) {
          return response.data;
        }

        return response as Client;
      }),
    );
  }

  getClientProfile(id: number): Observable<ClientProfileResponse> {
    return this.http
      .get<Partial<ClientProfileResponse> | { data?: Partial<ClientProfileResponse> }>(`${this.apiUrl}/${id}/profile`)
      .pipe(
        map((response) => {
          const payload =
            typeof response === 'object' && response !== null && 'data' in response && response.data
              ? response.data
              : (response as Partial<ClientProfileResponse>);
          return this.normalizeProfileResponse(payload, id);
        }),
        catchError(() =>
          this.getClient(id).pipe(
            map((client) => ({
              client,
              sales_count: 0,
              total_purchased: 0,
              last_sale_date: null,
              outstanding_balance: 0,
              sales: [],
              sales_history: [],
              summary: {
                outstanding_balance: 0,
                opening_balance: client.opening_balance ?? 0,
                credit_limit: client.credit_limit ?? 0,
                total_purchased: 0,
                total_paid: 0,
                last_sale_date: null,
              },
            })),
          ),
        ),
      );
  }

  getClientStatement(id: number): Observable<ClientStatementResponse> {
    return this.http
      .get<Partial<ClientStatementResponse> | { data?: Partial<ClientStatementResponse> }>(
        `${this.apiUrl}/${id}/statement`,
      )
      .pipe(
        map((response) => {
          const payload =
            typeof response === 'object' && response !== null && 'data' in response && response.data
              ? response.data
              : (response as Partial<ClientStatementResponse>);
          return this.normalizeStatementResponse(payload);
        }),
      );
  }

  checkDuplicates(name?: string, phone?: string): Observable<ClientDuplicateCheckResponse> {
    const trimmedName = name?.trim();
    const trimmedPhone = phone?.trim();

    if (!trimmedName && !trimmedPhone) {
      return of({ matches: [], total: 0 });
    }

    let params = new HttpParams();

    if (trimmedName) {
      params = params.set('name', trimmedName);
    }

    if (trimmedPhone) {
      params = params.set('phone', trimmedPhone);
    }

    return this.http
      .get<Client[] | ClientDuplicateCheckResponse | { data?: Client[]; matches?: Client[]; total?: number }>(
        `${this.apiUrl}/duplicates/check`,
        { params },
      )
      .pipe(
        map((response) => {
          if (Array.isArray(response)) {
            return {
              matches: response,
              total: response.length,
            };
          }

          const matches = ('matches' in response ? response.matches : undefined)
            ?? ('data' in response ? response.data : undefined)
            ?? [];

          return {
            matches,
            total: ('total' in response ? response.total : undefined) ?? matches.length,
          };
        }),
        catchError(() => of({ matches: [], total: 0 })),
      );
  }

  createClient(payload: ClientPayload): Observable<Client> {
    return this.http.post<Client | { data?: Client }>(this.apiUrl, payload).pipe(
      map((response) => {
        if ('data' in response && response.data) {
          return response.data;
        }

        return response as Client;
      }),
    );
  }

  updateClient(id: number, payload: ClientPayload): Observable<Client> {
    return this.http.put<Client | { data?: Client }>(`${this.apiUrl}/${id}`, payload).pipe(
      map((response) => {
        if ('data' in response && response.data) {
          return response.data;
        }

        return response as Client;
      }),
    );
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  exportClients(filters: ClientFilters = {}): Observable<Blob> {
    const { page, per_page, ...rest } = filters;
    const params = this.buildParams(rest);
    return this.http.get(`${this.apiUrl}/export`, { params, responseType: 'blob' });
  }

  getUnpaidSales(id: number): Observable<{ sales: UnpaidSaleRow[] }> {
    return this.http.get<{ sales: UnpaidSaleRow[] }>(`${this.apiUrl}/${id}/unpaid-sales`);
  }

  createClientPayment(id: number, payload: ClientPaymentPayload): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/${id}/payments`, payload);
  }

  deleteClientPayment(clientId: number, paymentId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${clientId}/payments/${paymentId}`);
  }

  private buildParams(filters: ClientFilters): HttpParams {
    let params = new HttpParams();

    const normalizedStatus =
      filters.status ?? (filters.is_active === true ? 'active' : filters.is_active === false ? 'inactive' : 'all');

    if (filters.search?.trim()) {
      params = params.set('search', filters.search.trim());
    }

    if (filters.name?.trim()) {
      params = params.set('name', filters.name.trim());
    }

    if (filters.phone?.trim()) {
      params = params.set('phone', filters.phone.trim());
    }

    if (filters.city?.trim()) {
      params = params.set('city', filters.city.trim());
    }

    if (filters.category?.trim()) {
      params = params.set('category', filters.category.trim());
    }

    if (normalizedStatus === 'active') {
      params = params.set('is_active', '1');
    }

    if (normalizedStatus === 'inactive') {
      params = params.set('is_active', '0');
    }

    if (filters.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters.per_page) {
      params = params.set('per_page', String(filters.per_page));
    }

    return params;
  }

  private extractListResponse(response: Client[] | ClientListResponse): ClientListResponse {
    if (Array.isArray(response)) {
      return {
        data: response,
        total: response.length,
        current_page: 1,
        last_page: 1,
        per_page: response.length,
      };
    }

    return {
      data: response.data ?? [],
      total: response.total,
      current_page: response.current_page,
      last_page: response.last_page,
      per_page: response.per_page,
    };
  }

  private normalizeProfileResponse(response: Partial<ClientProfileResponse>, id: number): ClientProfileResponse {
    const client = response.client ?? ({ id, name: 'Client' } as Client);
    const rawSales = response.sales ?? response.sales_history ?? [];
    const sales = rawSales.map((s) => this.normalizeSaleRow(s as unknown as Record<string, unknown>));

    return {
      client,
      sales_count: response.sales_count ?? sales.length,
      total_purchased: response.total_purchased ?? response.summary?.total_purchased ?? 0,
      last_sale_date: response.last_sale_date ?? response.summary?.last_sale_date ?? null,
      outstanding_balance: response.outstanding_balance ?? response.summary?.outstanding_balance ?? 0,
      sales,
      sales_history: sales,
      summary: response.summary ?? {
        total_purchased: response.total_purchased ?? 0,
        outstanding_balance: response.outstanding_balance ?? 0,
        last_sale_date: response.last_sale_date ?? null,
        opening_balance: client.opening_balance ?? 0,
        credit_limit: client.credit_limit ?? 0,
      },
    };
  }

  private normalizeStatementResponse(response: Partial<ClientStatementResponse>): ClientStatementResponse {
    const rawSales = response.sales ?? [];

    return {
      client: response.client ?? ({ id: 0, name: 'Client' } as Client),
      summary: response.summary ?? {
        total_purchased: 0,
        total_paid: 0,
        outstanding_balance: 0,
        opening_balance: 0,
        credit_limit: 0,
        last_sale_date: null,
      },
      sales: rawSales.map((s) => this.normalizeSaleRow(s as unknown as Record<string, unknown>)),
      payments: response.payments ?? [],
      entries: response.entries ?? [],
    };
  }

  private normalizeSaleRow(s: Record<string, unknown>): ClientSalesHistoryRow {
    return {
      id: s['id'] as number,
      sale_date: (s['sale_date'] ?? s['date'] ?? null) as string | null,
      created_at: (s['created_at'] ?? null) as string | null,
      reference: (s['reference'] ?? null) as string | null,
      invoice_number: (s['invoice_number'] ?? null) as string | null,
      total_amount: (s['total_amount'] ?? s['total'] ?? null) as number | null,
      amount_paid: (s['amount_paid'] ?? s['paid_amount'] ?? null) as number | null,
      balance_due: (s['balance_due'] ?? s['outstanding_amount'] ?? null) as number | null,
      status: (s['status'] ?? null) as string | null,
      payment_status: (s['payment_status'] ?? s['status'] ?? null) as string | null,
      client: (s['client'] ?? null) as string | null,
      client_phone: (s['client_phone'] ?? null) as string | null,
    };
  }
}
