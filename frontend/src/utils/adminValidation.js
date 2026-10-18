import rules from "../../../shared/validation.json" with { type: "json" };
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "./validation.js";

export { rules };
const plain = (value) => typeof value === "string";
const text = (value, label, limit, required = false, multiline = false) => {
  if (value == null && !required) return "";
  if (!plain(value) || value.length > limit)
    return `Enter a valid ${label} (up to ${limit} characters).`;
  if (required && !value.trim()) return `Enter your ${label}.`;
  if (
    [...value.trim()].some((character) => {
      const code = character.codePointAt(0);
      return (
        code === 127 ||
        (code < 32 && !(multiline && [9, 10, 13].includes(code)))
      );
    })
  )
    return `Remove control characters from ${label}.`;
  return "";
};
export function validateAmount(
  value,
  label = "amount",
  minimum = 0,
  maximum = rules.maxAmount,
) {
  if (
    !["string", "number"].includes(typeof value) ||
    !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(String(value).trim())
  )
    return `${label} must use ordinary digits and at most two decimal places.`;
  return Number.isFinite(Number(value)) &&
    Number(value) >= minimum &&
    Number(value) <= maximum
    ? ""
    : `${label} must be between ${minimum.toLocaleString("en-PH")} and ${maximum.toLocaleString("en-PH")}.`;
}
const withoutEmpty = (errors) =>
  Object.fromEntries(Object.entries(errors).filter(([, value]) => value));
export function validateProduct(form, existingCondition) {
  const condition = form.condition === undefined ? "Good" : form.condition;
  const errors = Object.fromEntries(
    Object.entries(rules.productText).map(([key, limit]) => [
      key,
      text(
        form[key],
        key,
        limit,
        ["name", "category"].includes(key),
        key === "description",
      ),
    ]),
  );
  errors.price = validateAmount(form.price, "Price");
  errors.stock =
    ["string", "number"].includes(typeof form.stock) &&
    /^[0-9]+$/.test(String(form.stock).trim()) &&
    Number.isSafeInteger(Number(form.stock)) &&
    Number(form.stock) <= rules.maxStock
      ? ""
      : `Stock must be a whole number between 0 and ${rules.maxStock.toLocaleString("en-PH")}.`;
  errors.condition =
    rules.conditions.includes(condition) ||
    (condition === existingCondition && !text(condition, "condition", 40, true))
      ? ""
      : "Choose a valid condition.";
  return withoutEmpty(errors);
}
export const validatePhone = (value) =>
  text(value, "mobile number", rules.phoneMaxLength) ||
  (value && !/^(09\d{9}|\+?639\d{9})$/.test(value.replace(/[\s()-]/g, ""))
    ? "Enter a valid Philippine mobile number, such as 0912 345 6789."
    : "");
export function validateAccount(form, creating = true) {
  return withoutEmpty({
    username: creating
      ? validateUsername(form.username)
      : text(form.username, "username", 80, true),
    email: validateEmail(form.email),
    firstName: text(form.firstName, "first name", rules.profileNameMaxLength),
    lastName: text(form.lastName, "last name", rules.profileNameMaxLength),
    phone: validatePhone(form.phone),
    password:
      creating || form.password !== "" ? validatePassword(form.password) : "",
    isAdmin:
      form.isAdmin === undefined || typeof form.isAdmin === "boolean"
        ? ""
        : "Choose a valid account role.",
    ...(Object.hasOwn(form, "roleId")
      ? {
          roleId:
            typeof form.roleId === "string" &&
            /^[a-f0-9]{24}$/i.test(form.roleId)
              ? ""
              : "Choose an available account role.",
        }
      : {}),
    isActive:
      form.isActive === undefined || typeof form.isActive === "boolean"
        ? ""
        : "Choose valid account availability.",
  });
}
export function storeToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validateDiscount(form) {
  const scope = form.applyTo === undefined ? "all" : form.applyTo;
  const code = plain(form.code) ? form.code.trim().toUpperCase() : "";
  const expiry = form.validUntil;
  const dateValid =
    plain(expiry) &&
    /^\d{4}-\d{2}-\d{2}$/.test(expiry) &&
    Number.isFinite(Date.parse(expiry + "T00:00:00Z")) &&
    new Date(expiry + "T00:00:00Z").toISOString().slice(0, 10) === expiry &&
    expiry >= storeToday();
  return withoutEmpty({
    code: /^[A-Z0-9_-]{1,40}$/.test(code)
      ? ""
      : "Use 1–40 letters, numbers, underscores or hyphens for the code.",
    discountType: ["fixed", "percentage"].includes(form.discountType)
      ? ""
      : "Choose a valid discount type.",
    value: validateAmount(
      form.value,
      "Discount amount",
      0.01,
      form.discountType === "percentage" ? 100 : rules.maxAmount,
    ),
    minPurchase: validateAmount(
      form.minPurchase === "" || form.minPurchase == null
        ? 0
        : form.minPurchase,
      "Minimum purchase",
    ),
    applyTo: ["all", "category"].includes(scope)
      ? ""
      : "Choose a valid discount scope.",
    category:
      scope === "category"
        ? text(form.category, "category", rules.productText.category, true)
        : "",
    validUntil:
      expiry === "" || expiry == null || dateValid
        ? ""
        : "Choose today or a future expiration date.",
  });
}
export function validatePayment(method, file) {
  return withoutEmpty({
    merchantName: text(
      method.merchantName,
      "merchant name",
      rules.merchantNameMaxLength,
      true,
    ),
    enabled:
      typeof method.enabled === "boolean"
        ? ""
        : "Choose valid payment availability.",
    image:
      method.enabled && !method.qrUrl && !file
        ? "Upload the real merchant QR image before enabling this method."
        : "",
  });
}
export const validateTracking = (value) =>
  plain(value) && /^[0-9]{12}$/.test(value.trim())
    ? ""
    : "Tracking number must be exactly 12 digits.";
export function validateImageFile(file, maximum = rules.image.maxBytes) {
  if (!file) return "";
  if (!file.size || file.size > maximum)
    return `Choose an image smaller than ${maximum / 1024 / 1024} MB.`;
  const extension = file.name?.split(".").pop().toLowerCase();
  const types = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  if (!types[extension] || (file.type && types[extension] !== file.type))
    return "Choose a JPG, PNG, GIF or WebP image with a matching file extension.";
  return "";
}
