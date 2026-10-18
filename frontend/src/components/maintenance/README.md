# Maintenance workspace

`registry.js` is the single module catalog for navigation, overview cards and page titles. Each entry has a title, description, group, icon, optional customer preview path and lazy component. Add new module pages here; do not duplicate their metadata in the router.

Use `MaintenancePanel`, `MaintenanceFeedback`, `MaintenanceLoading` and `MaintenanceSaveBar` for module layout and feedback. Editors own their fields and business validation; these shared components own presentation.

`useMaintenanceEditor` manages loading, a saved baseline, dirty state, validation feedback, save errors, conflict handling and discard. Supply `loadPath`, `savePath`, `select(response)` and `serialize(form, originalResponse)`. Keep forms immutable and retain server revision/version identifiers in the original response. The API remains authoritative for authorization and validation. A failed request keeps the draft. `useContentEditor` is the revision-aware adapter for FAQs and contact information.

`ContentEditorStatus` provides load retries and a confirmation before replacing an edited draft after a conflict. `resetRevision` clears upload errors and native file validity when an editor is saved, discarded or reloaded.

`MaintenanceWorkspace` tracks module drafts, warns before reload/close and intercepts ordinary in-app navigation links. Editors with separate persistence, such as the role dialog, register with `useMaintenanceDraft`. Public previews open in a new tab. The link guard does not intercept browser history or arbitrary imperative navigation; avoid navigating an active editor programmatically without settling its draft.

Policy editors mount on first visit and stay mounted while switching policy tabs. FAQ identifiers stay stable when reordered; validation opens collapsed sections before focusing an invalid control. Role mutation rules and permission enforcement stay on the server; the role dialog is a separate component.

Check each module at phone and desktop widths, initial-load failure/retry, field validation, successful save, discard, unsaved navigation, and revision/version conflicts. Use the disposable browser fixture described in the root README; do not create test records in the store database.
