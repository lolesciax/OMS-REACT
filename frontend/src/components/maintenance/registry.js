import { lazy } from "react";

export const maintenanceGroups = [
  "Store operations",
  "Customer information",
  "System",
];
export const maintenanceModules = {
  payments: {
    title: "Payments",
    description: "Manage merchant details, QR codes and payment availability.",
    group: "Store operations",
    icon: "bag",
    component: lazy(() => import("./PaymentMaintenance")),
  },
  roles: {
    title: "Account roles",
    description: "Manage store access and review role assignments.",
    group: "Store operations",
    icon: "shield",
    component: lazy(() => import("./RolesMaintenance")),
  },
  profile: {
    title: "Profile choices",
    description: "Maintain the options customers see in their account.",
    group: "Store operations",
    icon: "user",
    component: lazy(() => import("./ProfileOptionsMaintenance")),
  },
  policies: {
    title: "Policies & terms",
    description:
      "Edit and publish your store’s policies without replacing earlier versions.",
    group: "Customer information",
    icon: "orders",
    publicPath: "/policies",
    component: lazy(() => import("./PolicyMaintenance")),
  },
  faqs: {
    title: "FAQs",
    description: "Keep customer questions and answers clear and up to date.",
    group: "Customer information",
    icon: "orders",
    publicPath: "/faqs",
    component: lazy(() => import("./FaqMaintenance")),
  },
  support: {
    title: "Contact details",
    description: "Update the contact information shown on the storefront.",
    group: "Customer information",
    icon: "user",
    publicPath: "/contact",
    component: lazy(() => import("./SupportMaintenance")),
  },
  security: {
    title: "Security & recovery",
    description: "Review account protection and email recovery configuration.",
    group: "System",
    icon: "settings",
    component: lazy(() => import("./SecurityMaintenance")),
  },
};
