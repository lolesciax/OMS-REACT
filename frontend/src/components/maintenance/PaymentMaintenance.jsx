import useMaintenanceEditor from "../../hooks/useMaintenanceEditor";
import { validatePayment, rules } from "../../utils/adminValidation";
import Image from "../Image";
import UploadField from "../UploadField";
import FieldError from "../FieldError";
import ContentEditorStatus from "./ContentEditorStatus";
import {
  MaintenancePanel,
  MaintenanceLoading,
  MaintenanceSaveBar,
} from "./MaintenanceUI";

function PaymentMethod({ methodKey }) {
  const editor = useMaintenanceEditor({
    loadPath: "/admin/maintenance/payments",
    savePath: "/admin/maintenance/payments/" + methodKey,
    prefix: "payment-" + methodKey,
    select: (data) => ({ ...data.methods[methodKey], imageFile: null }),
    serialize: (form) => {
      const data = new FormData();
      data.set("merchantName", form.merchantName.trim());
      data.set("enabled", String(form.enabled));
      if (form.imageFile) data.set("image", form.imageFile);
      return data;
    },
    successMessage:
      methodKey === "gcash"
        ? "GCash payment details saved."
        : "Maya payment details saved.",
  });
  const { form, setForm, busy, validation } = editor;
  const label = methodKey === "gcash" ? "GCash" : "Maya";
  return (
    <MaintenancePanel
      title={label}
      description="Confirm the merchant name and scan the QR before making this payment method available."
      actions={
        form && (
          <span
            className={
              "rounded-full px-3 py-1 text-small font-semibold " +
              (editor.saved?.enabled
                ? "bg-[#e7f0df] text-forest"
                : "bg-[#f3eee3] text-[#795e2e]")
            }
          >
            {editor.saved?.enabled
              ? "Available at checkout"
              : "Unavailable at checkout"}
          </span>
        )
      }
    >
      <ContentEditorStatus editor={editor} />
      {editor.loading ? (
        <MaintenanceLoading label={"Loading " + label} />
      ) : (
        form && (
          <form
            ref={validation.formRef}
            noValidate
            onSubmit={(event) =>
              editor.save(event, validatePayment(form, form.imageFile))
            }
            onChange={(event) => validation.clear(event.target.name)}
          >
            <fieldset disabled={busy} className="min-w-0 border-0">
              {form.qrUrl ? (
                <div className="mb-5 grid place-items-center rounded-xl border border-line bg-[#f7f8f3] p-4">
                  <Image
                    className="h-40 w-40 object-contain"
                    src={form.qrUrl}
                    alt={label + " saved merchant QR"}
                  />
                  <p className="mt-3 text-small text-muted">
                    Current saved QR code
                  </p>
                </div>
              ) : (
                <div className="mb-5 rounded-xl border border-dashed border-line bg-[#f7f8f3] p-6 text-center text-body text-muted">
                  No merchant QR uploaded yet.
                </div>
              )}
              <div className="ui-field mb-5">
                <label htmlFor={methodKey + "-merchant"}>Merchant name</label>
                <input
                  id={methodKey + "-merchant"}
                  {...validation.bind("merchantName")}
                  value={form.merchantName}
                  maxLength={rules.merchantNameMaxLength}
                  onChange={(event) =>
                    setForm({ ...form, merchantName: event.target.value })
                  }
                  placeholder="Name shown in the wallet app"
                />
                <FieldError
                  id={validation.errorId("merchantName")}
                  error={validation.errors.merchantName}
                />
              </div>
              <UploadField
                resetKey={editor.resetRevision}
                name="image"
                file={form.imageFile}
                label={
                  form.qrUrl ? "Replace merchant QR" : "Upload merchant QR"
                }
                onChange={(file) =>
                  setForm((previous) => ({ ...previous, imageFile: file }))
                }
                onError={(message) => {
                  if (message) validation.check({ image: message });
                  else validation.clear("image");
                }}
                error={validation.errors.image}
                disabled={busy}
              />
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 text-body">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-forest"
                  {...validation.bind("enabled")}
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                />
                <span>
                  <strong className="block">Available at checkout</strong>
                  <span className="mt-1 block text-small text-muted">
                    Customers can select this method after a valid QR is saved.
                  </span>
                </span>
              </label>
              <FieldError
                id={validation.errorId("enabled")}
                error={validation.errors.enabled}
              />
            </fieldset>
            <MaintenanceSaveBar
              dirty={editor.dirty}
              busy={busy}
              onDiscard={editor.discard}
              label={"Save " + label}
            />
          </form>
        )
      )}
    </MaintenancePanel>
  );
}
export default function PaymentMaintenance() {
  return (
    <div className="grid min-w-0 gap-6 min-[1350px]:grid-cols-2">
      <PaymentMethod methodKey="gcash" />
      <PaymentMethod methodKey="paymaya" />
    </div>
  );
}
