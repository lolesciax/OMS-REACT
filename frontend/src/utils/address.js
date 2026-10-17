export function validateAddress(address) {
  const errors = {};
  for (const [key, label] of Object.entries({
    recipient: "recipient name",
    contact: "mobile number",
    street: "street address",
    barangay: "barangay",
    city: "city or municipality",
    province: "province",
  })) {
    if (!String(address[key] || "").trim())
      errors[key] = `Enter your ${label}.`;
  }
  if (
    address.contact &&
    !/^(09\d{9}|\+?639\d{9})$/.test(
      String(address.contact).replace(/[\s()-]/g, ""),
    )
  )
    errors.contact =
      "Enter a valid Philippine mobile number, such as 0912 345 6789.";
  return errors;
}
