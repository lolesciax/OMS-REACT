# Maintenance workspace

`registry.js` is the single module catalog for navigation, overview cards and page titles. Each entry has a title, description, group, icon, optional customer preview path and lazy component. Add new module pages here; do not duplicate their metadata in the router.

Use `MaintenancePanel`, `MaintenanceFeedback`, `MaintenanceLoading` and `MaintenanceSaveBar` for module layout and feedback. Editors own their fields and business validation; these shared components own presentation.

`useMaintenanceEditor` manages loading, a saved baseline, dirty state, validation feedback, save errors, conflict handling and discard. Supply `loadPath`, `savePath`, `select(response)` and `serialize(form, originalResponse)`. Keep forms immutable and retain server revision/version identifiers in the original response. The API remains authoritative for authorization and validation. A failed request keeps the draft. `useContentEditor` is the revision-aware adapter for FAQs and contact information.

`ContentEditorStatus` provides load retries and a confirmation before replacing an edited draft after a conflict. `resetRevision` clears upload errors and native file validity when an editor is saved, discarded or reloaded.

The shared editor emits success toasts after successful saves and explicit discards. Keep failures inline near the form; do not emit success on validation errors or conflicts. For separate action handlers, import `toast` from `services/feedback` and call `toast.success(message)` after checking both the HTTP result and any `success: false` response. Use `toast.info(message)` for staged changes that still need saving. Polling, initial loads, availability checks and checkout autosaves stay silent. `ToastRegion` lives outside the router so feedback survives navigation; it supports keyboard dismissal, reduced motion and paused expiry during focus, hover or a hidden tab.

`AdminSidebar` owns navigation presentation; `useWorkspaceSidebar` owns drag/resize state, persistence and failed-save rollback. `utils/workspaceNavigation` defines route metadata and merges saved orders with available sections, always placing Maintenance last. Preferences are saved to the signed-in administrator's MongoDB user document through `PUT /api/users/workspace-preferences`. The server enforces administrator access, CSRF, the complete route set, pinned Maintenance and a width of 220–360 pixels. Use Arrange to drag links, or focus a grip and use the up/down arrow keys; drag the desktop edge or use its arrow keys to resize. No browser storage is used.

`MaintenanceWorkspace` tracks module drafts, warns before reload/close and intercepts ordinary in-app navigation links. Editors with separate persistence, such as the role dialog, register with `useMaintenanceDraft`. Public previews open in a new tab. The link guard does not intercept browser history or arbitrary imperative navigation; avoid navigating an active editor programmatically without settling its draft.

Policy editors mount on first visit and stay mounted while switching policy tabs. FAQ identifiers stay stable when reordered; validation opens collapsed sections before focusing an invalid control. Role mutation rules and permission enforcement stay on the server; the role dialog is a separate component.

Check each module at phone and desktop widths, initial-load failure/retry, field validation, successful save, discard, unsaved navigation, and revision/version conflicts. Use the disposable browser fixture described in the root README; do not create test records in the store database.
