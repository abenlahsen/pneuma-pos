import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { FilterPillsComponent } from './filter-pills.component';

describe('FilterPillsComponent', () => {
  const options = [
    { value: 'EN COURS', label: 'En cours' },
    { value: 'LIVRE', label: 'Livrée' },
    { value: 'MONTE', label: 'Montée' },
  ];

  function render(selected: string[]) {
    TestBed.configureTestingModule({
      imports: [FilterPillsComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(FilterPillsComponent);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    const emitted: string[][] = [];
    fixture.componentInstance.selectedChange.subscribe((v) => emitted.push(v));
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    return { buttons, emitted };
  }

  it('renders one pressed pill per selected status', () => {
    const { buttons } = render(['LIVRE']);
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['En cours', 'Livrée', 'Montée']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('adds a status, keeping the options order', () => {
    const { buttons, emitted } = render(['MONTE']);
    buttons[0].click();
    expect(emitted).toEqual([['EN COURS', 'MONTE']]);
  });

  it('removes a status that was already selected', () => {
    const { buttons, emitted } = render(['EN COURS', 'LIVRE']);
    buttons[1].click();
    expect(emitted).toEqual([['EN COURS']]);
  });
});
