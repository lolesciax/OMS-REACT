import { rules, validatePhone, storeToday } from "./adminValidation.js";

export function validateProfile(profile, options = [], saved = {}) {
  const errors = {};
  for (const key of ["firstName", "lastName"])
    if (
      typeof profile[key] !== "string" ||
      profile[key].length > rules.profileNameMaxLength ||
      [...profile[key]].some(
        (character) =>
          character.codePointAt(0) < 32 || character.codePointAt(0) === 127,
      )
    )
      errors[key] =
        `Use up to ${rules.profileNameMaxLength} characters without control characters.`;
  const phone = validatePhone(profile.phone);
  if (phone) errors.phone = phone;
  if (
    profile.dob &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(profile.dob) ||
      !Number.isFinite(Date.parse(profile.dob)) ||
      new Date(profile.dob).toISOString().slice(0, 10) !== profile.dob ||
      profile.dob > storeToday())
  )
    errors.dob = "Choose a valid birthday in the past.";
  if (
    profile.gender &&
    !options.includes(profile.gender) &&
    profile.gender !== saved.gender
  )
    errors.gender = "Choose an available gender option.";
  return errors;
}
