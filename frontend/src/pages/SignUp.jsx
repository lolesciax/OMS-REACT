import { toast } from "../services/feedback";
import { useState, useRef } from "react";
import FieldTooltip from "../components/FieldTooltip";
import CaptchaField from "../components/CaptchaField";
import TermsAgreement from "../components/TermsAgreement";
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
  const [focused, setFocused] = useState(null);
  const [captcha, setCaptcha] = useState("");
  const [captchaKey, setCaptchaKey] = useState(0);
  const [terms, setTerms] = useState({ accepted: false, version: "" });
  const [termsKey, setTermsKey] = useState(0);
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
        setAvailability((previous) => ({
          ...previous,
          [field]: "unavailable",
        }));
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
      termsAccepted:
        !terms.accepted || !terms.version
          ? "Read and accept the terms and conditions."
          : "",
      captcha: !captcha ? "Complete the security verification." : "",
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
        confirmPassword: form.confirm,
        captcha,
        termsAccepted: terms.accepted,
        termsVersion: terms.version,
      });
      toast.success("Your account is ready. Sign in to start exploring.");
      navigate("/login", {
        replace: true,
        state: { ...state, username: form.username.trim() },
      });
    } catch (error) {
      setCaptcha("");
      setCaptchaKey((value) => value + 1);
      if (error.fields?.termsVersion) setTermsKey((value) => value + 1);
      setErrors({
        ...error.fields,
        ...(error.fields?.termsVersion
          ? { termsAccepted: error.fields.termsVersion }
          : {}),
        submit:
          error.message || "We couldn’t create your account. Please try again.",
      });
      requestAnimationFrame(() =>
        document
          .getElementById(
            `signup-${Object.keys(error.fields || {})[0] === "termsVersion" ? "termsAccepted" : Object.keys(error.fields || {})[0]}`,
          )
          ?.focus(),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthLayout mode="signup">
      <h1 id="auth-heading">Create your account.</h1>
      <p className="auth-intro mb-6">Save your finds and track your orders.</p>
      {errors.submit && (
        <div className="ui-message error" role="alert">
          {errors.submit}
        </div>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset
          disabled={busy}
          className="ui-fieldset min-w-0 border-0 p-0 m-0"
        >
          {["username", "email"].map((field) => {
            const invalid = !!errors[field] || availability[field] === "taken";
            const feedback =
              errors[field] ||
              (availability[field] === "checking"
                ? "Checking availability…"
                : availability[field] === "available"
                  ? "Available — you can use this."
                  : availability[field] === "taken"
                    ? `This ${field === "email" ? "email is already registered" : "username is already taken"}.`
                    : availability[field] === "unavailable"
                      ? "Availability could not be checked. We’ll check again when you submit."
                      : field === "username"
                        ? "Use 3–16 letters, numbers or underscores."
                        : "Enter a valid email address you can access. We’ll use it for account recovery.");
            return (
              <div className="ui-field mb-5 min-w-0" key={field}>
                <FieldTooltip
                  id={`signup-${field}-feedback`}
                  htmlFor={`signup-${field}`}
                  label={field === "username" ? "Username" : "Email address"}
                  message={feedback}
                  invalid={invalid}
                  active={focused === field && invalid}
                  available={availability[field] === "available" && !invalid}
                />
                <input
                  id={`signup-${field}`}
                  name={field}
                  type={field === "email" ? "email" : "text"}
                  autoComplete={field}
                  value={form[field]}
                  onChange={(event) => change(field, event.target.value)}
                  onFocus={() => setFocused(field)}
                  onBlur={() => {
                    setFocused(null);
                    check(field);
                  }}
                  maxLength={field === "username" ? 16 : 254}
                  aria-invalid={
                    !!errors[field] || availability[field] === "taken"
                  }
                  aria-describedby={`signup-${field}-feedback`}
                  placeholder={
                    field === "username"
                      ? "Choose a username"
                      : "you@example.com"
                  }
                />
              </div>
            );
          })}

          <PasswordField
            id="signup-password"
            name="password"
            value={form.password}
            onChange={(event) => change("password", event.target.value)}
            autoComplete="new-password"
            maxLength={128}
            error={errors.password}
            onBlur={() =>
              setErrors((previous) => ({
                ...previous,
                password: validatePassword(form.password),
              }))
            }
            hint="Use 8–128 characters. Spaces and symbols are welcome."
            compact
            tooltip
          />
          <div className="mt-5">
            <PasswordField
              id="signup-confirm"
              label="Confirm password"
              name="confirm"
              value={form.confirm}
              onChange={(event) => change("confirm", event.target.value)}
              autoComplete="new-password"
              maxLength={128}
              error={errors.confirm}
              hint="Enter your password again. Both passwords must match."
              compact
              tooltip
              onBlur={() =>
                setErrors((previous) => ({
                  ...previous,
                  confirm: !form.confirm
                    ? "Confirm your password."
                    : validateConfirmPassword(form.password, form.confirm),
                }))
              }
            />
          </div>

          <div className="mt-5">
            <TermsAgreement
              key={termsKey}
              kind="account"
              id="signup-termsAccepted"
              value={terms}
              onChange={(value) => {
                setTerms(value);
                setErrors((previous) => ({
                  ...previous,
                  termsAccepted: "",
                  termsVersion: "",
                }));
              }}
              error={errors.termsAccepted || errors.termsVersion}
              disabled={busy}
            />
          </div>

          <div className="mt-5">
            <CaptchaField
              key={captchaKey}
              purpose="signup"
              id="signup-captcha"
              onChange={(value) => {
                setCaptcha(value);
                setErrors((previous) => ({ ...previous, captcha: "" }));
              }}
              error={errors.captcha}
              compact
            />
          </div>

          <button
            className="ui-button ui-button-dark auth-submit"
            type="submit"
          >
            {busy ? "Creating your account…" : "Create account"}
            <Icon name="arrow" size={18} />
          </button>

          <p className="auth-switch">
            Already part of the thrift?{" "}
            <Link to="/login" state={state}>
              Sign in
            </Link>
          </p>
        </fieldset>
      </form>
    </AuthLayout>
  );
}
