# Design QA — UrbanBlade sidebar V2

## Reference and result
Spike Admin was captured at 1440×1024 in `../barber/output/sidebar-audit/01-spike-dashboard.png`. The authenticated UrbanBlade dashboard was compared at the same desktop interaction states: expanded sidebar and collapsed rail.

- Desktop shell now uses the reference mechanism: inset floating sidebar, rounded independent topbar, visible page gutter and content reflow.
- Expanded state is 272px; collapsed state is an 88px rail with the UB mark, centered navigation icons and profile avatar.
- The topbar owns the persistent collapse control and includes contextual page title, search, theme selector, push status and account identity.
- Fixed navigation, grouped sections, full-width active row and anchored profile preserve UrbanBlade's route and role model.
- Theme details and mascots derive from `data-theme`; navigation logic is not duplicated.
- Persistent collapse and accordions reuse `useShellState`.
- The helper opens the existing Concierge through a scoped event.
- Existing mobile topbar, bottom navigation and drawer remain intact.
- Targets are at least 44px; collapsed items retain accessible titles; reduced motion is supported.
- `noir`, `acero`, `salon` and `libreta` were switched in the authenticated dashboard; the floating shell remained mounted and each theme applied its own sidebar surface.
- ESLint and production build passed. Authenticated `/dashboard` was visually verified in expanded, collapsed and light-theme states.
- Browser console: zero errors after the final reload and interactions.

Remaining P3: the dashboard's own inner cards intentionally keep UrbanBlade's denser information style instead of copying Spike's content cards.

final result: passed
