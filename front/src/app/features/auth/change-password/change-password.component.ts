import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: '../login/login.component.scss',
})
export class ChangePasswordComponent {
  form: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.form = this.fb.group({
      current_password: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', [Validators.required]],
    });
  }

  get passwordsMismatch(): boolean {
    return this.form.get('password')?.value !== this.form.get('password_confirmation')?.value;
  }

  onSubmit(): void {
    if (this.form.invalid || this.passwordsMismatch) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.changePassword(this.form.value).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Erreur lors du changement de mot de passe');
      },
    });
  }
}
