import { AccountsPageComponent } from './accounts-page.component';
import { Account } from '../../../core/models/account.model';

function account(overrides: Partial<Account>): Account {
  return {
    id: 1,
    name: 'Compte',
    type: 'cash',
    current_balance: 0,
    expected_balance: 0,
    is_active: true,
    ...overrides,
  } as Account;
}

function make(accounts: Account[]): AccountsPageComponent {
  const comp = new AccountsPageComponent({} as any, {} as any, { hasPermission: () => true } as any);
  comp.accounts.set(accounts);
  return comp;
}

/**
 * Refonte 2b, 7b — la bande de cellules à filet qui remplace les quatre cadrans
 * à icône colorée. Le total couvre tous les comptes ; les deux cellules de
 * nature n'en montrent que deux, ce qui se voit dans les tests ci-dessous.
 */
describe('AccountsPageComponent — la bande de 7b', () => {
  it('additionne tous les comptes, quelle que soit leur nature', () => {
    const comp = make([
      account({ id: 1, type: 'cash', current_balance: 1200 }),
      account({ id: 2, type: 'bank', current_balance: 48000 }),
      account({ id: 3, type: 'person', current_balance: 500 }),
    ]);
    expect(comp.totalBalance()).toBe(49700);
  });

  it('sépare caisse et banque', () => {
    const comp = make([
      account({ id: 1, type: 'cash', current_balance: 1200 }),
      account({ id: 2, type: 'cash', current_balance: 300 }),
      account({ id: 3, type: 'bank', current_balance: 48000 }),
    ]);
    expect(comp.cashBalance()).toBe(1500);
    expect(comp.bankBalance()).toBe(48000);
  });

  it("ne range pas un compte de personne dans l'une des deux natures", () => {
    const comp = make([account({ id: 1, type: 'person', current_balance: 900 })]);
    expect(comp.cashBalance()).toBe(0);
    expect(comp.bankBalance()).toBe(0);
    // ... mais il compte dans le total, qui est bien le total.
    expect(comp.totalBalance()).toBe(900);
  });

  it('supporte un solde négatif sans le traiter comme une absence', () => {
    const comp = make([
      account({ id: 1, type: 'bank', current_balance: -2400 }),
      account({ id: 2, type: 'cash', current_balance: 400 }),
    ]);
    expect(comp.bankBalance()).toBe(-2400);
    expect(comp.totalBalance()).toBe(-2000);
  });

  it('compte les comptes actifs, pas tous les comptes', () => {
    const comp = make([
      account({ id: 1, is_active: true }),
      account({ id: 2, is_active: false }),
      account({ id: 3, is_active: true }),
    ]);
    expect(comp.activeCount()).toBe(2);
    expect(comp.accounts().length).toBe(3);
  });

  it('vaut zéro sans aucun compte, sans lever', () => {
    const comp = make([]);
    expect(comp.totalBalance()).toBe(0);
    expect(comp.activeCount()).toBe(0);
  });
});
