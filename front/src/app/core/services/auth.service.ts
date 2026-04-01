import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginPayload, RegisterPayload, User, UserResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = environment.apiUrl;
  private readonly currentUser = signal<User | null>(null);
  private readonly userPermissions = signal<string[]>([]);
  private readonly tokenKey = 'auth_token';
  private userLoaded: Promise<void> | null = null;

  readonly user = this.currentUser.asReadonly();
  readonly permissions = this.userPermissions.asReadonly();
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    if (token) {
      this.userLoaded = firstValueFrom(this.fetchUser()).then(
        () => {},
        () => this.clearAuth(),
      );
    }
  }

  /** Resolves once user + permissions are loaded (used by guards) */
  whenReady(): Promise<void> {
    return this.userLoaded ?? Promise.resolve();
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.currentUser.set(response.user);
        this.userPermissions.set(response.permissions || []);
      }),
    );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, payload).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.currentUser.set(response.user);
        this.userPermissions.set(response.permissions || []);
      }),
    );
  }

  logout(): void {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      complete: () => {
        this.clearAuth();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.clearAuth();
        this.router.navigate(['/login']);
      },
    });
  }

  fetchUser(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.apiUrl}/user`).pipe(
      tap((response) => {
        this.currentUser.set(response.user);
        this.userPermissions.set(response.permissions || []);
      }),
    );
  }

  hasPermission(permission: string): boolean {
    return this.userPermissions().includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this.userPermissions().includes(p));
  }

  hasRole(role: string): boolean {
    return this.currentUser()?.roles?.some(r => r.name === role) || false;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUser.set(null);
    this.userPermissions.set([]);
  }
}
