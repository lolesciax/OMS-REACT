import { Suspense } from "react";
import { Link, NavLink, Navigate, useParams } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import PageSkeleton from "./PageSkeleton";
import Icon from "./Icon";
import {
  maintenanceGroups,
  maintenanceModules as modules,
} from "./maintenance/registry";
import MaintenanceWorkspace from "./maintenance/MaintenanceWorkspace";

export default function AdminMaintenance() {
  const { section } = useParams();
  if (section && !Object.hasOwn(modules, section))
    return <Navigate to="/admin/maintenance" replace />;
  const Module = modules[section]?.component;
  return (
    <MaintenanceWorkspace>
      <AdminLayout
        title={section ? modules[section].title : "System maintenance"}
        description={
          section
            ? modules[section].description
            : "Manage store operations, customer information and account protection in one place."
        }
        actions={
          modules[section]?.publicPath && (
            <Link
              className="ui-button ui-button-light"
              to={modules[section].publicPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              View customer page <Icon name="arrow" size={16} />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          )
        }
      >
        <div className="grid min-w-0 items-start gap-6 min-[1200px]:grid-cols-[208px_minmax(0,1fr)]">
          <aside className="min-w-0 min-[1200px]:sticky min-[1200px]:top-6">
            <div className="ui-field min-[1200px]:hidden">
              <label htmlFor="maintenance-section">Maintenance section</label>
              <select
                id="maintenance-section"
                value={section || ""}
                onChange={(event) => {
                  document
                    .querySelector(
                      `[data-maintenance-link="${event.target.value}"]`,
                    )
                    ?.click();
                  event.target.value = section || "";
                }}
              >
                <option value="">Overview</option>
                {maintenanceGroups.map((group) => (
                  <optgroup key={group} label={group}>
                    {Object.entries(modules)
                      .filter(([, value]) => value.group === group)
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.title}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <nav
              className="hidden rounded-2xl border border-line bg-white p-3 min-[1200px]:block"
              aria-label="Maintenance modules"
            >
              <NavLink
                end
                data-maintenance-link=""
                to="/admin/maintenance"
                className={({ isActive }) =>
                  `mb-4 flex min-h-11 items-center gap-3 rounded-lg px-3 text-body font-semibold ${isActive ? "bg-primary text-white" : "text-primary hover:bg-primary-soft"}`
                }
              >
                <Icon name="settings" size={18} />
                Overview
              </NavLink>
              {maintenanceGroups.map((group) => (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="px-3 py-2 text-small font-semibold text-muted">
                    {group}
                  </p>
                  {Object.entries(modules)
                    .filter(([, value]) => value.group === group)
                    .map(([key, value]) => (
                      <NavLink
                        key={key}
                        data-maintenance-link={key}
                        to={`/admin/maintenance/${key}`}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-small font-semibold ${isActive ? "bg-primary text-white" : "text-ink hover:bg-primary-soft"}`
                        }
                      >
                        <Icon name={value.icon} size={17} />
                        {value.title}
                      </NavLink>
                    ))}
                </div>
              ))}
            </nav>
          </aside>
          <div className="min-w-0">
            {Module ? (
              <Suspense
                fallback={
                  <PageSkeleton
                    variant="settings"
                    label="Loading maintenance module"
                  />
                }
              >
                <Module key={section} />
              </Suspense>
            ) : (
              <div className="space-y-8">
                {maintenanceGroups.map((group) => (
                  <section key={group}>
                    <h2 className="mb-4 text-lead font-semibold">{group}</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(modules)
                        .filter(([, value]) => value.group === group)
                        .map(([key, value]) => (
                          <article
                            className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-sm"
                            key={key}
                          >
                            <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                              <Icon name={value.icon} size={23} />
                            </span>
                            <h3 className="text-lead font-semibold">
                              {value.title}
                            </h3>
                            <p className="my-4 flex-1 text-body leading-relaxed text-muted">
                              {value.description}
                            </p>
                            <Link
                              className="ui-button ui-button-light self-start"
                              to={`/admin/maintenance/${key}`}
                            >
                              Open module
                              <Icon name="arrow" size={17} />
                            </Link>
                          </article>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </AdminLayout>
    </MaintenanceWorkspace>
  );
}
