import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StateBadgeComponent } from './state-badge.component';
import { StateSelectComponent } from './state-select.component';

// Hotes en signaux : sans zone.js, muter une propriete simple ne redessine rien.
@Component({
  standalone: true,
  imports: [StateBadgeComponent],
  template: `<app-state-badge [tone]="tone()">{{ label() }}</app-state-badge>`,
})
class BadgeHostComponent {
  readonly tone = signal<'neutral' | 'alert'>('neutral');
  readonly label = signal('PAYE');
}

describe('StateBadgeComponent', () => {
  async function renderBadge() {
    await TestBed.configureTestingModule({
      imports: [BadgeHostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(BadgeHostComponent);
    await fixture.whenStable();
    return fixture;
  }

  it('projects the label written at the call site', async () => {
    const fixture = await renderBadge();

    const badge = (fixture.nativeElement as HTMLElement).querySelector('app-state-badge')!;
    expect(badge.textContent?.trim()).toBe('PAYE');
  });

  // Le ton pilote la seule difference visuelle : bordure et texte en
  // --accent-700. Il est lu sur l'hote, pas sur un span interne.
  it('carries the tone on its host element, neutral by default', async () => {
    const fixture = await renderBadge();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('app-state-badge')!;

    expect(badge.getAttribute('data-tone')).toBe('neutral');

    fixture.componentInstance.tone.set('alert');
    await fixture.whenStable();

    expect(badge.getAttribute('data-tone')).toBe('alert');
  });

  // Aucun span interne : le badge se pose seul dans une cellule de tableau.
  it('renders no wrapper element around the content', async () => {
    const fixture = await renderBadge();
    const badge = (fixture.nativeElement as HTMLElement).querySelector('app-state-badge')!;

    expect(badge.children).toHaveLength(0);
  });
});

@Component({
  standalone: true,
  imports: [StateSelectComponent],
  template: `
    <app-state-select
      [value]="value()"
      [options]="options()"
      [labels]="labels()"
      [disabled]="disabled()"
      (valueChange)="received.push($event)" />
  `,
})
class SelectHostComponent {
  // Deliberement pas la premiere option : sinon le repli du navigateur sur
  // l'index 0 masque une valeur jamais posee, et le test ne prouve rien.
  readonly value = signal('LIVRE');
  readonly options = signal<readonly string[]>(['EN COURS', 'LIVRE', 'ANNULE']);
  readonly labels = signal<Record<string, string | undefined>>({
    'EN COURS': 'En cours',
    LIVRE: 'Livrée',
    ANNULE: 'Annulée',
  });
  readonly disabled = signal(false);
  readonly received: string[] = [];
}

describe('StateSelectComponent', () => {
  async function renderSelect() {
    await TestBed.configureTestingModule({
      imports: [SelectHostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(SelectHostComponent);
    await fixture.whenStable();
    const select = (fixture.nativeElement as HTMLElement).querySelector('select') as HTMLSelectElement;
    return { fixture, select };
  }

  it('renders one option per value, labelled', async () => {
    const { select } = await renderSelect();

    expect([...select.options].map((o) => o.value)).toEqual(['EN COURS', 'LIVRE', 'ANNULE']);
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'En cours',
      'Livrée',
      'Annulée',
    ]);
  });

  // Le piege du <select> : sans coordination, la valeur est posee avant que
  // les <option> existent et la liste retombe sur la premiere entree.
  it('preselects the current value', async () => {
    const { fixture, select } = await renderSelect();

    expect(select.value).toBe('LIVRE');

    fixture.componentInstance.value.set('ANNULE');
    await fixture.whenStable();

    expect(select.value).toBe('ANNULE');
  });

  it('falls back to the raw value when no label is given', async () => {
    const { fixture, select } = await renderSelect();

    fixture.componentInstance.labels.set({});
    await fixture.whenStable();

    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      'EN COURS',
      'LIVRE',
      'ANNULE',
    ]);
  });

  // La valeur, pas l'evenement : c'est ce qui fait disparaitre les
  // `$event.target.value` des trois pages appelantes.
  it('emits the picked value as a plain string', async () => {
    const { fixture, select } = await renderSelect();

    select.value = 'ANNULE';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(fixture.componentInstance.received).toEqual(['ANNULE']);
  });

  it('disables the select when asked', async () => {
    const { fixture, select } = await renderSelect();

    expect(select.disabled).toBe(false);

    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(select.disabled).toBe(true);
  });
});
