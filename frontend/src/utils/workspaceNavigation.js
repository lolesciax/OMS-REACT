export const workspaceLinks = [
  ["dashboard", "Overview", "leaf"],
  ["products", "Products", "bag"],
  ["orders", "Orders", "orders"],
  ["customers", "People", "user"],
  ["discounts", "Discount codes", "shield"],
  ["maintenance", "Maintenance", "settings"],
];
export function workspacePreferences(value) {
  const keys = workspaceLinks.map(([key]) => key);
  const order = Array.isArray(value?.sidebarOrder) ? value.sidebarOrder : [];
  return {
    sidebarOrder: [...new Set([...order, ...keys])]
      .filter((key) => keys.includes(key) && key !== "maintenance")
      .concat("maintenance"),
    sidebarWidth: Number.isInteger(value?.sidebarWidth)
      ? Math.max(220, Math.min(360, value.sidebarWidth))
      : 260,
  };
}
export function moveWorkspaceItem(order, source, target) {
  if (
    source === "maintenance" ||
    target === "maintenance" ||
    !order.includes(source) ||
    !order.includes(target)
  )
    return order;
  const next = order.filter((key) => key !== source);
  next.splice(next.indexOf(target), 0, source);
  return next;
}
