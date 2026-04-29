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

describe('ProductsPageComponent', () => {
  describe('ngOnInit', () => {
    it('sets searchQuery when ?search= param is present', () => {
      const svc = makeProductService();
      const comp = new ProductsPageComponent(svc as any, mockAuthService as any, makeRoute({ search: 'michelin' }) as any);
      comp.ngOnInit();
      expect(comp.searchQuery()).toBe('michelin');
    });

    it('leaves searchQuery empty when ?search= param is absent', () => {
      const svc = makeProductService();
      const comp = new ProductsPageComponent(svc as any, mockAuthService as any, makeRoute({}) as any);
      comp.ngOnInit();
      expect(comp.searchQuery()).toBe('');
    });

    it('calls getProduct(42) and opens view modal when ?id=42 with no ?edit=1', () => {
      const svc = makeProductService(of(fakeProduct));
      const comp = new ProductsPageComponent(svc as any, mockAuthService as any, makeRoute({ id: '42' }) as any);
      comp.ngOnInit();
      expect(svc.getProduct).toHaveBeenCalledWith(42);
      expect(comp.viewingProduct()).toEqual(fakeProduct);
      expect(comp.showForm()).toBe(false);
    });

    it('calls getProduct(42) and opens edit form when ?id=42&edit=1', () => {
      const svc = makeProductService(of(fakeProduct));
      const comp = new ProductsPageComponent(svc as any, mockAuthService as any, makeRoute({ id: '42', edit: '1' }) as any);
      comp.ngOnInit();
      expect(svc.getProduct).toHaveBeenCalledWith(42);
      expect(comp.editingProduct()).toEqual(fakeProduct);
      expect(comp.showForm()).toBe(true);
    });

    it('does NOT call getProduct when ?id= param is absent', () => {
      const svc = makeProductService();
      const comp = new ProductsPageComponent(svc as any, mockAuthService as any, makeRoute({ search: 'foo' }) as any);
      comp.ngOnInit();
      expect(svc.getProduct).not.toHaveBeenCalled();
    });
  });
});
