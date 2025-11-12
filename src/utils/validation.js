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

export const validateEmail = (email) => {
  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailPattern.test(email)) {
    return "Please enter a valid Gmail address (example@gmail.com)";
  }
  return "";
};

export const validatePassword = (password) => {
  if (password.length < 8 || password.length > 16) {
    return "Password must be 8–16 characters long.";
  }
  
  // No special characters allowed - only letters and numbers
  const passwordPattern = /^[a-zA-Z0-9]+$/;
  if (!passwordPattern.test(password)) {
    return "Password cannot contain special characters. Only letters and numbers are allowed.";
  }
  
  // Check for at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  if (!hasLetter || !hasNumber) {
    return "Password must contain both letters and numbers.";
  }
  
  return "";
};

export const validateConfirmPassword = (password, confirmPassword) => {
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
};