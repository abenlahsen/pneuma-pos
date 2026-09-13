import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

import { TableSkeletonComponent } from './table-skeleton.component';

@Component({
  standalone: true,
  imports: [TableSkeletonComponent],
  template: `
    <table>
      <tbody app-table-skeleton [columns]="columns" [rows]="rows"></tbody>
    </table>
  `,
})
class HostComponent {
  columns = 4;
  rows = 6;
}

describe('TableSkeletonComponent', () => {
  async function render(columns?: number, rows?: number) {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    if (columns !== undefined) fixture.componentInstance.columns = columns;
    if (rows !== undefined) fixture.componentInstance.rows = rows;
    await fixture.whenStable();
    return fixture;
  }

  it('mirrors the table geometry: one cell per column, on every row', async () => {
    const fixture = await render(17, 6);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('tr')).toHaveLength(6);
    expect(host.querySelectorAll('tr')[0].querySelectorAll('td')).toHaveLength(17);
    expect(host.querySelectorAll('td')).toHaveLength(17 * 6);
  });

  it('defaults to six placeholder rows', async () => {
    await TestBed.configureTestingModule({
      imports: [TableSkeletonComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture = TestBed.createComponent(TableSkeletonComponent);
    fixture.componentRef.setInput('columns', 3);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('tr')).toHaveLength(6);
  });

  it('renders a grey block in each cell rather than a spinner', async () => {
    const fixture = await render(4, 2);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.sk')).toHaveLength(8);
    expect(host.querySelectorAll('.spinner')).toHaveLength(0);
  });
});
