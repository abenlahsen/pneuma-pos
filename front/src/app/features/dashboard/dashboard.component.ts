import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/auth.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  user = signal<User | null>(null);

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.authService.fetchUser().subscribe({
      next: (response) => this.user.set(response.user),
    });
  }

  logout(): void {
    this.authService.logout();
  }
}

