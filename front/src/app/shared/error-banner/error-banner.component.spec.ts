import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { ErrorBannerComponent, formatErrorDetail } from './error-banner.component';

describe('formatErrorDetail', () => {
  const at = new Date(2026, 8, 14, 14, 22, 7);

  it('builds the one-line technical detail, origin and query string stripped', () => {
    expect(formatErrorDetail('GET', 'http://localhost:8888/api/sales?page=1&search=x', 504, at))
      .toBe('GET /api/sales — 504 · 14:22:07');
  });

  it('keeps a relative url untouched', () => {
    expect(formatErrorDetail('DELETE', '/api/sales/1031', 403, at))
      .toBe('DELETE /api/sales/1031 — 403 · 14:22:07');
  });

  it('pads single-digit time parts so the timestamp stays comparable', () => {
    expect(formatErrorDetail('GET', '/api/sales', 500, new Date(2026, 8, 14, 9, 5, 3)))
      .toBe('GET /api/sales — 500 · 09:05:03');
  });

  it('reports a status of 0 as "réseau" rather than a bare zero', () => {
    expect(formatErrorDetail('GET', '/api/sales', 0, at))
      .toBe('GET /api/sales — réseau · 14:22:07');
  });
});

describe('ErrorBannerComponent', () => {
  async function render(inputs: Record<string, unknown>) {
    await TestBed.configureTestingModule({
      imports: [ErrorBannerComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(ErrorBannerComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture;
  }

  it('shows the technical detail so a report needs no screenshot', async () => {
    const fixture = await render({
      title: 'Impossible de charger les ventes',
      detail: 'GET /api/sales — 504 · 14:22:07',
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Impossible de charger les ventes');
    expect(text).toContain('GET /api/sales — 504 · 14:22:07');
  });

  it('emits retry when the retry button is clicked', async () => {
    const fixture = await render({ title: 'Erreur', detail: 'GET /api/sales — 504 · 14:22:07' });

    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.btn-retry')!.click();

    expect(retried).toBe(1);
  });

  it('copies the technical detail to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const fixture = await render({ title: 'Erreur', detail: 'GET /api/sales — 504 · 14:22:07' });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.btn-copy')!.click();

    expect(writeText).toHaveBeenCalledWith('GET /api/sales — 504 · 14:22:07');
    vi.unstubAllGlobals();
  });
});
