import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  user = signal<User | null>(null);

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.fetchUser().subscribe({
      next: (user) => this.user.set(user),
    });
  }

  logout(): void {
    this.authService.logout();
  }
}

