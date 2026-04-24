import { Component, EventEmitter, Input, OnInit, Output, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface IntervalOption {
  label: string;
  value: number;
}

@Component({
  selector: 'app-auto-refresh-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auto-refresh-control.component.html',
  styleUrl: './auto-refresh-control.component.scss',
})
export class AutoRefreshControlComponent implements OnInit {
  @Input() pageKey!: string;
  @Input() defaultIntervalMs = 60_000;
  @Output() refresh = new EventEmitter<void>();

  enabled = signal(false);
  intervalMs = signal(60_000);

  readonly options: IntervalOption[] = [
    { label: '30 sec', value: 30_000 },
    { label: '1 min', value: 60_000 },
    { label: '5 min', value: 300_000 },
    { label: '10 min', value: 600_000 },
  ];

  constructor() {
    effect((onCleanup) => {
      if (!this.enabled()) {
        return;
      }

      const ms = this.intervalMs();
      const id = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.refresh.emit();
        }
      }, ms);

      onCleanup(() => clearInterval(id));
    });
  }

  ngOnInit(): void {
    const storedEnabled = localStorage.getItem(this.enabledKey());
    const storedInterval = localStorage.getItem(this.intervalKey());

    this.intervalMs.set(this.parseInterval(storedInterval));
    this.enabled.set(storedEnabled === 'true');
  }

  toggle(): void {
    const next = !this.enabled();
    this.enabled.set(next);
    localStorage.setItem(this.enabledKey(), String(next));
  }

  onIntervalChange(value: string): void {
    const ms = Number.parseInt(value, 10);
    if (!Number.isFinite(ms) || ms <= 0) {
      return;
    }

    this.intervalMs.set(ms);
    localStorage.setItem(this.intervalKey(), String(ms));
  }

  private parseInterval(stored: string | null): number {
    if (!stored) {
      return this.defaultIntervalMs;
    }

    const parsed = Number.parseInt(stored, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : this.defaultIntervalMs;
  }

  private enabledKey(): string {
    return `${this.pageKey}-refresh-enabled`;
  }

  private intervalKey(): string {
    return `${this.pageKey}-refresh-interval-ms`;
  }
}
