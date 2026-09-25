import { RolesPageComponent } from './roles-page.component';
import { Role } from '../models/role.model';

/**
 * Refonte 2b, étape 11 — la ligne de liste des rôles. Méthodes pures : le
 * composant est créé sans son constructeur (services injectés).
 */
describe('RolesPageComponent', () => {
  let comp: RolesPageComponent;

  const role = (name: string, perms: string[]): Role =>
    ({ id: 1, name, permissions: perms.map((p, i) => ({ id: i, name: p })) }) as unknown as Role;

  beforeEach(() => {
    comp = Object.create(RolesPageComponent.prototype);
    (comp as any).authService = { hasPermission: () => true };
  });

  it('verrouille le rôle système, et lui seul', () => {
    expect(comp.isSystemRole(role('Administrator', []))).toBe(true);
    expect(comp.canEditRole(role('Administrator', []))).toBe(false);
    expect(comp.canEditRole(role('Commercial', []))).toBe(true);
  });

  it('compte les permissions en sous-ligne', () => {
    expect(comp.permissionCountLabel(role('X', []))).toBe('Aucune permission');
    expect(comp.permissionCountLabel(role('X', ['view sales']))).toBe('1 permission');
    expect(comp.permissionCountLabel(role('X', ['view sales', 'edit sales']))).toBe('2 permissions');
  });

  it('résume les permissions en modules, sans doublon', () => {
    expect(comp.roleModules(role('X', ['view sales', 'edit sales', 'view purchases', 'view stock'])))
      .toBe('Ventes, Achats, Stock');
  });
});
