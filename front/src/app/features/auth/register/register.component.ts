import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  registerForm: FormGroup;
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
  ) {
    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      password_confirmation: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    const { password, password_confirmation } = this.registerForm.value;
    if (password !== password_confirmation) {
      this.error.set('Les mots de passe ne correspondent pas');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.error?.errors) {
          const messages = Object.values(err.error.errors).flat();
          this.error.set(messages.join(', '));
        } else {
          this.error.set(err.error?.message || "Erreur lors de l'inscription");
        }
      },
    });
  }
}

