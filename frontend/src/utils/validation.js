export const validateUsername = (username, takenUsernames = []) => {
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

export const validateEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? ""
    : "Enter a valid email address.";

export const validatePassword = (password) =>
  password.length >= 8 && password.length <= 128
    ? ""
    : "Password must be 8 to 128 characters long.";

export const validateConfirmPassword = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
};
