# UI Reusable Components

Base visual compartida para web responsive y futura app mobile.

## Implementados

- `SurfaceCard`: contenedor visual base para tarjetas, paneles y widgets.
- `PageHeader`: encabezado estandar de modulo con eyebrow, titulo y acciones.
- `SearchInput`: campo de busqueda consistente para topbar y listados.
- `ListView`: listado reutilizable con busqueda, paginacion de servidor, tabla desktop y cards mobile.
- `MetricCard`: tarjeta KPI con variante visual, subtitulo y tendencia.
- `LineChartCard`: grafico ligero para indicadores temporales.
- `DonutChartCard`: composicion de cartera o distribuciones.
- `EventList`: lista compacta para agenda, comunicados o pendientes.
- `QuickActionGrid`: accesos rapidos mobile-first.
- `MobileBottomNav`: navegacion inferior para pantallas pequenas.
- `StatusBadge`: estado semantico reutilizable.
- `FormModal`: base de formularios emergentes.
- `ConfirmDialog`: confirmacion destructiva.
- `ThemeToggle`: cambio de modo claro/oscuro.

## Siguientes recomendados

- `EntitySummaryCard`: resumen de estudiante, acudiente, docente o factura.
- `FilterBar`: filtros avanzados con chips, fechas y exportacion.
- `StatTrendMini`: mini sparkline para tablas y cards.
- `EmptyModuleState`: variante con CTA y ayuda contextual.
- `SplitDetailDrawer`: detalle lateral reutilizable para entidades CRUD.
- `MobileSectionTabs`: tabs compactos para modulos academicos y financieros.

## Convencion

- Desktop: sidebar + topbar + paneles.
- Mobile: topbar compacta + quick actions + bottom nav.
- Los listados nuevos deben montarse sobre `ListView`.
