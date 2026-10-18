import useMaintenanceEditor from "./useMaintenanceEditor";

export default function useContentEditor(kind) {
  return useMaintenanceEditor({
    loadPath: "/content/" + kind,
    savePath: "/admin/maintenance/content/" + kind,
    prefix: kind,
    select: (data) => data.content.data,
    serialize: (form, source) => ({
      data: form,
      revision: source.content.revision,
    }),
    successMessage: "Published. Customers can now see the updated information.",
    onSaved: () =>
      window.dispatchEvent(
        new CustomEvent("store:content-updated", { detail: kind }),
      ),
  });
}
