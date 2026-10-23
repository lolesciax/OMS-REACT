import useMaintenanceResource from "../../hooks/useMaintenanceResource";
import {
  MaintenancePanel,
  MaintenanceFeedback,
  MaintenanceLoading,
} from "./MaintenanceUI";
import Icon from "../Icon";

export default function SecurityMaintenance() {
  const status = useMaintenanceResource("/admin/maintenance/security");
  const controls = [
    {
      title: "Sign-in verification",
      icon: "shield",
      badge: "Required",
      text: "CAPTCHA verification is required for sign-in and registration. Challenges expire and can only be used once.",
    },
    {
      title: "Terms acceptance",
      icon: "orders",
      badge: "Required",
      text: "New accounts and orders must accept the current terms. Accepted policy versions remain recorded.",
    },
    {
      title: "Account access",
      icon: "user",
      badge: "Enforced",
      text: "Database roles, expiring sessions, request limits and CSRF checks protect access to the store.",
    },
    {
      title: "Password recovery",
      icon: "settings",
      badge: status.data?.passwordRecoveryConfigured
        ? "Email settings detected"
        : "Not configured",
      attention: !status.data?.passwordRecoveryConfigured,
      text: status.data?.passwordRecoveryConfigured
        ? "Server email settings are present. Use Forgot password on sign-in to check actual email delivery."
        : "Configure the store email service on the server to enable recovery codes. Customers can contact the store while recovery is unavailable.",
    },
  ];
  return (
    <MaintenancePanel
      title="Account protection"
      description="Review active safeguards and recovery configuration. Security credentials are maintained on the server."
      actions={
        <button
          type="button"
          className="ui-button ui-button-light"
          disabled={status.loading}
          onClick={status.reload}
        >
          <Icon name="refresh" size={17} />
          Refresh status
        </button>
      }
    >
      <MaintenanceFeedback
        error={status.error}
        onRetry={status.reload}
        busy={status.loading}
      />
      {status.loading ? (
        <MaintenanceLoading label="Checking security configuration" />
      ) : (
        status.data && (
          <div className="grid gap-4 min-[1350px]:grid-cols-2">
            {controls.map((control) => (
              <article
                key={control.title}
                className="rounded-xl border border-line p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Icon
                    name={control.icon}
                    size={23}
                    className="text-primary"
                  />
                  <span
                    className={
                      "rounded-full px-3 py-1 text-small font-semibold " +
                      (control.attention
                        ? "bg-[#fbefd8] text-[#805d23]"
                        : "bg-primary-soft text-primary")
                    }
                  >
                    {control.badge}
                  </span>
                </div>
                <h3 className="text-lead font-semibold">{control.title}</h3>
                <p className="mt-3 text-body leading-relaxed text-muted">
                  {control.text}
                </p>
              </article>
            ))}
          </div>
        )
      )}
    </MaintenancePanel>
  );
}
