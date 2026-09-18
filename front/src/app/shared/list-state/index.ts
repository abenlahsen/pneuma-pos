// Refonte 2b, §14c — les quatre états manquants des listes :
// chargement, liste vide après filtrage, erreur de chargement, action verrouillée.
export type { ActiveFilter } from './active-filter.model';
export { describeLoadError, type LoadErrorInfo } from './load-error';
export { frenchDate } from './filter-label';
export { ListEmptyComponent } from './list-empty.component';
export { ListErrorComponent } from './list-error.component';
export { RowLockComponent } from './row-lock.component';
export { SkeletonCellsComponent, SkeletonRowComponent } from './skeleton-row.component';
