import { useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import Icon from "../components/Icon";
import { authAPI } from "../services/api";
import {
  validateUsername,
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from "../utils/validation";

export default function SignUp() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [availability, setAvailability] = useState({});
  const [busy, setBusy] = useState(false);
  const request = useRef({ username: 0, email: 0 });
  const change = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "", submit: "" }));
    if (field === "username" || field === "email") {
      request.current[field]++;
      setAvailability((previous) => ({ ...previous, [field]: null }));
    }
  };
  const check = async (field) => {
    const value = form[field].trim();
    const error =
      field === "username" ? validateUsername(value) : validateEmail(value);
    if (!value || error) {
      if (value) setErrors((previous) => ({ ...previous, [field]: error }));
      return;
    }
    const current = ++request.current[field];
    setAvailability((previous) => ({ ...previous, [field]: "checking" }));
    try {
      const data = await (field === "username"
        ? authAPI.checkUsername(value)
        : authAPI.checkEmail(value));
      if (current !== request.current[field]) return;
      setAvailability((previous) => ({
        ...previous,
        [field]: data.available ? "available" : "taken",
      }));
    } catch {
      if (current === request.current[field])
        setAvailability((previous) => ({ ...previous, [field]: null }));
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = {
      username: validateUsername(form.username.trim()),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: validateConfirmPassword(form.password, form.confirm),
    };
    if (!form.confirm) validation.confirm = "Confirm your password.";
    if (availability.username === "taken")
      validation.username = "This username is already taken.";
    if (availability.email === "taken")
      validation.email = "This email already has an account. Try signing in.";
    setErrors(validation);
    const first = Object.keys(validation).find((key) => validation[key]);
    if (first) {
      document.getElementById(`signup-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await authAPI.signUp({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate("/login", {
        replace: true,
        state: { ...state, created: true, username: form.username.trim() },
      });
    } catch (error) {
      setErrors({
        submit:
          error.message || "We couldn’t create your account. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout mode="signup">
      <h1 id="auth-heading">Make yourself at home.</h1>
      <p className="auth-intro">
        Create an account to save your finds and follow their journey to you.
      </p>
      {errors.submit && (
        <div className="ui-message error" role="alert">
          {errors.submit}
        </div>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className="ui-fieldset">
          {["username", "email"].map((field) => (
            <div className="ui-field" key={field}>
              <label htmlFor={`signup-${field}`}>
                {field === "username" ? "Username" : "Email address"}
              </label>
              <input
                id={`signup-${field}`}
                name={field}
                type={field === "email" ? "email" : "text"}
                autoComplete={field}
                value={form[field]}
                onChange={(event) => change(field, event.target.value)}
                onBlur={() => check(field)}
                maxLength={field === "username" ? 16 : 254}
                aria-invalid={
                  !!errors[field] || availability[field] === "taken"
                }
                aria-describedby={`signup-${field}-feedback`}
                placeholder={
                  field === "username" ? "Choose a username" : "you@example.com"
                }
              />
              <p
                id={`signup-${field}-feedback`}
                className={
                  errors[field] || availability[field] === "taken"
                    ? "ui-field-error"
                    : "ui-field-hint"
                }
                aria-live="polite"
              >
                {errors[field] ||
                  (availability[field] === "checking"
                    ? "Checking availability…"
                    : availability[field] === "available"
                      ? "Available — looking good."
                      : availability[field] === "taken"
                        ? `This ${field === "email" ? "email is already registered" : "username is already taken"}.`
                        : field === "username"
                          ? "3–16 characters. Letters, numbers, and underscores."
                          : "We’ll use this for account recovery.")}
              </p>
            </div>
          ))}
          <PasswordField
            id="signup-password"
            name="password"
            value={form.password}
            onChange={(event) => change("password", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            error={errors.password}
            hint="Use 8–128 characters. Spaces and symbols are welcome."
          />
          <PasswordField
            id="signup-confirm"
            label="Confirm password"
            name="confirm"
            value={form.confirm}
            onChange={(event) => change("confirm", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            error={errors.confirm}
          />
          <button
            className="ui-button ui-button-dark auth-submit"
            type="submit"
          >
            {busy ? "Creating your account…" : "Create account"}
            <Icon name="arrow" size={18} />
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        Already part of the thrift?{" "}
        <Link to="/login" state={state}>
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
