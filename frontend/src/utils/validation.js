import rules from "../../../shared/validation.json" with { type: "json" };

export const validateUsername = (username, takenUsernames = []) => {
  if (typeof username !== "string") return "Enter a valid username.";
  username = username.trim();
  if (username.length < 3) {
    return "Username must be at least 3 characters.";
  }

  if (username.length > 16) {
    return "Username must be 16 characters or less.";
  }

  // Only allow letters, numbers, and underscores
  const usernamePattern = /^[a-zA-Z0-9_]+$/;
  if (!usernamePattern.test(username)) {
    return "Username can only contain letters, numbers, and underscores.";
  }

  if (takenUsernames.includes(username.toLowerCase())) {
    return "This username is already taken.";
  }
  return "";
};

export const validateEmail = (email) => {
  if (typeof email !== "string") return "Enter a valid email address.";
  const value = email.trim();
  if (
    value.length > rules.emailMaxLength ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  )
    return "Enter a valid email address.";
  const [local, domain] = value.toLowerCase().split("@");
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
    domain.length > 253 ||
    domain
      .split(".")
      .some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
    !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(domain.split(".").at(-1))
  )
    return "Enter a valid email address and domain, such as you@example.com.";
  return local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    value.includes("..") ||
    domain.split(".").some((part) => part.startsWith("-") || part.endsWith("-"))
    ? "Enter a valid email address."
    : "";
};

export const validatePassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 128 &&
  password.trim()
    ? ""
    : "Password must be 8 to 128 characters long.";

export const validateConfirmPassword = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
};
