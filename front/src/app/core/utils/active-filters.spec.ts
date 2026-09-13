import { describeActiveFilters } from './active-filters';

describe('describeActiveFilters', () => {
  it('says nothing when no filter is active', () => {
    expect(describeActiveFilters([])).toBe('');
  });

  it('uses the singular for a single filter', () => {
    expect(describeActiveFilters([{ label: 'Statut', value: 'LIVRE' }]))
      .toBe('Le filtre « Statut : LIVRE » est actif.');
  });

  it('joins two filters with « et »', () => {
    expect(describeActiveFilters([
      { label: 'Statut', value: 'LIVRE' },
      { label: 'Ville', value: 'Casablanca' },
    ])).toBe('Les filtres « Statut : LIVRE » et « Ville : Casablanca » sont actifs.');
  });

  it('separates with commas and keeps « et » before the last one', () => {
    expect(describeActiveFilters([
      { label: 'Statut', value: 'LIVRE' },
      { label: 'Ville', value: 'Casablanca' },
      { label: 'Période', value: 'du 01/09/2026 au 07/09/2026' },
    ])).toBe('Les filtres « Statut : LIVRE », « Ville : Casablanca » et « Période : du 01/09/2026 au 07/09/2026 » sont actifs.');
  });

  it('drops filters whose value is empty, so a blank select never shows up', () => {
    expect(describeActiveFilters([
      { label: 'Statut', value: '' },
      { label: 'Ville', value: 'Casablanca' },
    ])).toBe('Le filtre « Ville : Casablanca » est actif.');
  });

  it('renders a filter without value as its label alone', () => {
    expect(describeActiveFilters([{ label: 'Avec facture', value: 'Oui' }, { label: 'Recherche', value: '2055516' }]))
      .toBe('Les filtres « Avec facture : Oui » et « Recherche : 2055516 » sont actifs.');
  });
});
