import test from "node:test";
import assert from "node:assert/strict";
import { validateProfile } from "../src/utils/profileValidation.js";
import { validateAccount } from "../src/utils/adminValidation.js";

const profile = {
  firstName: "Alex",
  lastName: "Reyes",
  phone: "0912 345 6789",
  dob: "2000-02-29",
  gender: "Custom choice",
};

test("account choices come from the catalog and preserve unchanged historical selections", () => {
  assert.deepEqual(validateProfile(profile, ["Custom choice"]), {});
  assert.deepEqual(validateProfile(profile, ["Other choice"], profile), {});
  assert.deepEqual(Object.keys(validateProfile(profile, ["Other choice"])), [
    "gender",
  ]);
  assert.deepEqual(validateProfile({ ...profile, gender: "" }, []), {});
});

test("profile errors include every invalid field and reject impossible birthdays", () => {
  const errors = validateProfile(
    {
      ...profile,
      firstName: "Alex\n",
      phone: "123",
      dob: "2001-02-29",
      gender: "Invalid",
    },
    [],
  );
  assert.deepEqual(Object.keys(errors).sort(), [
    "dob",
    "firstName",
    "gender",
    "phone",
  ]);
  assert.ok(
    validateProfile({ ...profile, dob: "2999-01-01" }, [profile.gender]).dob,
  );
});

test("admin account forms require an actual role identifier", () => {
  const account = {
    username: "test_user",
    email: "test@example.com",
    password: "Example-123!",
    roleId: "",
    isActive: true,
  };
  assert.ok(validateAccount(account).roleId);
  assert.deepEqual(
    validateAccount({ ...account, roleId: "1234567890abcdef12345678" }),
    {},
  );
});
