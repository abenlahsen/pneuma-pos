import { Observable, of, EMPTY } from 'rxjs';
import { ProductsPageComponent } from './products-page.component';
import { Product } from '../models/product.model';

const emptyPage = { data: [], current_page: 1, last_page: 1, total: 0 };
const emptyFilters = { brands: [], types: [], seasons: [], units: [], part_categories: [], service_categories: [], profiles: [] };
const fakeProduct: Product = { id: 42, type: 'tyre', is_active: true, reference: 'TEST-42' } as any;

function makeRoute(params: Record<string, string | null>) {
  return { snapshot: { queryParamMap: { get: (k: string) => params[k] ?? null } } };
}

function makeProductService(getProductReturn: Observable<Product | never> = EMPTY) {
  return {
    getProducts: vi.fn().mockReturnValue(of(emptyPage)),
    getFilters:  vi.fn().mockReturnValue(of(emptyFilters)),
    getProduct:  vi.fn().mockReturnValue(getProductReturn),
  };
}

const mockAuthService = { hasPermission: vi.fn().mockReturnValue(false) };

/** Depuis l'étape 5a, ?id=&edit=1 ne remplit plus une modale : il navigue. */
function makeRouter() {
  return { navigate: vi.fn() };
}

function build(svc: unknown, route: unknown, router = makeRouter()) {
  const comp = new ProductsPageComponent(svc as any, mockAuthService as any, route as any, router as any);
  return { comp, router };
}

describe('ProductsPageComponent', () => {
  describe('ngOnInit', () => {
    it('sets searchQuery when ?search= param is present', () => {
      const svc = makeProductService();
      const { comp } = build(svc, makeRoute({ search: 'michelin' }));
      comp.ngOnInit();
      expect(comp.searchQuery()).toBe('michelin');
    });

    it('leaves searchQuery empty when ?search= param is absent', () => {
      const svc = makeProductService();
      const { comp } = build(svc, makeRoute({}));
      comp.ngOnInit();
      expect(comp.searchQuery()).toBe('');
    });

    // Refonte 2b, 6c : product-detail est supprimé. Les deux formes du lien
    // — avec ou sans ?edit=1 — mènent maintenant au même éditeur, et sans
    // charger le produit au passage : la route s'en charge.
    it("route vers l'éditeur avec ?id=42, sans charger le produit", () => {
      const svc = makeProductService(of(fakeProduct));
      const { comp, router } = build(svc, makeRoute({ id: '42' }));
      comp.ngOnInit();
      expect(svc.getProduct).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/products', 42, 'edit']);
    });

    it("route vers l'éditeur avec ?id=42&edit=1 — même destination", () => {
      const svc = makeProductService(of(fakeProduct));
      const { comp, router } = build(svc, makeRoute({ id: '42', edit: '1' }));
      comp.ngOnInit();
      expect(router.navigate).toHaveBeenCalledWith(['/products', 42, 'edit']);
    });

    it('does NOT call getProduct when ?id= param is absent', () => {
      const svc = makeProductService();
      const { comp } = build(svc, makeRoute({ search: 'foo' }));
      comp.ngOnInit();
      expect(svc.getProduct).not.toHaveBeenCalled();
    });
  });
});
