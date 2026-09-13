import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  async function render(inputs: Record<string, unknown>) {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(EmptyStateComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    await fixture.whenStable();
    return fixture;
  }

  it('states the title and the reason the table is empty', async () => {
    const fixture = await render({
      title: 'Aucune vente sur cette période',
      message: 'Le filtre « Impayées » est actif sur les 7 derniers jours.',
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Aucune vente sur cette période');
    expect(text).toContain('Le filtre « Impayées » est actif sur les 7 derniers jours.');
  });

  it('renders no action button when no label is given', async () => {
    const fixture = await render({ title: 'Aucune vente' });

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });

  it('emits secondaryAction and primaryAction when their buttons are clicked', async () => {
    const fixture = await render({
      title: 'Aucune vente',
      secondaryLabel: 'Retirer le filtre',
      primaryLabel: 'Nouvelle vente',
    });

    const emitted: string[] = [];
    fixture.componentInstance.secondaryAction.subscribe(() => emitted.push('secondary'));
    fixture.componentInstance.primaryAction.subscribe(() => emitted.push('primary'));

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    (buttons[0] as HTMLButtonElement).click();
    (buttons[1] as HTMLButtonElement).click();

    expect(emitted).toEqual(['secondary', 'primary']);
  });
});
