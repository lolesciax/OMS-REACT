import { useState } from "react";
import ConfirmDialog from "../ConfirmDialog";
import { MaintenanceFeedback } from "./MaintenanceUI";

export default function ContentEditorStatus({ editor }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <MaintenanceFeedback
        error={editor.error}
        busy={editor.busy}
        onRetry={
          editor.loadError || editor.conflict
            ? () => (editor.dirty ? setConfirm(true) : editor.reload())
            : undefined
        }
        retryLabel={editor.conflict ? "Reload latest version" : "Try again"}
      />
      {confirm && (
        <ConfirmDialog
          title="Reload the published version?"
          description="This replaces your unsaved draft with the latest saved content."
          confirmLabel="Reload and discard draft"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            editor.reload();
          }}
        />
      )}
    </>
  );
}
