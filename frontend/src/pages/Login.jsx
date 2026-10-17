import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { authAPI } from "../services/api";
import { validateEmail, validatePassword } from "../utils/validation";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/PasswordField";
import Icon from "../components/Icon";
import useDialog from "../hooks/useDialog";
import { postLoginPath } from "../utils/navigation";

export default function Login() {
  const { login } = useAuth();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: state?.username || "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [reset, setReset] = useState({
    username: "",
    email: "",
    token: "",
    password: "",
    confirm: "",
  });
  const [step, setStep] = useState("request");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const modal = useDialog(resetOpen, () => {
    if (!resetBusy) setResetOpen(false);
  });
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = {
      username: !form.username.trim() ? "Enter your username." : "",
      password: !form.password ? "Enter your password." : "",
    };
    setErrors(validation);
    const first = Object.keys(validation).find((field) => validation[field]);
    if (first) {
      document.getElementById(`login-${first}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const data = await authAPI.login({
        username: form.username.trim(),
        password: form.password,
      });
      login(data.user);
      navigate(postLoginPath(data.user, state?.from), {
        replace: true,
      });
    } catch (error) {
      setErrors({
        submit: error.message || "We couldn’t sign you in. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };
  const resetSubmit = async (event) => {
    event.preventDefault();
    if (resetBusy) return;
    setResetError("");
    setResetMessage("");
    if (!reset.username.trim() || validateEmail(reset.email)) {
      setResetError("Enter your username and a valid email address.");
      return;
    }
    if (
      step === "verify" &&
      (!reset.token.trim() ||
        validatePassword(reset.password) ||
        reset.password !== reset.confirm)
    ) {
      setResetError(
        !reset.token.trim()
          ? "Enter the verification code from your email."
          : validatePassword(reset.password) || "The passwords don’t match.",
      );
      return;
    }
    setResetBusy(true);
    try {
      if (step === "request") {
        const data = await authAPI.requestPasswordReset({
          username: reset.username.trim(),
          email: reset.email.trim(),
        });
        setResetMessage(data.message);
        setStep("verify");
      } else {
        await authAPI.forgotPassword({
          username: reset.username.trim(),
          email: reset.email.trim(),
          token: reset.token.trim(),
          new_password: reset.password,
        });
        setStep("done");
      }
    } catch (error) {
      setResetError(
        error.message || "We couldn’t complete this request. Please try again.",
      );
    } finally {
      setResetBusy(false);
    }
  };
  return (
    <AuthLayout mode="login">
      <h1 id="auth-heading">Welcome back.</h1>
      <p className="auth-intro">
        Your next favorite find is just around the corner.
      </p>
      {state?.created && (
        <div className="ui-message success" role="status">
          Your account is ready. Sign in to start exploring.
        </div>
      )}
      {errors.submit && (
        <div className="ui-message error" role="alert">
          {errors.submit}
        </div>
      )}
      <form onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy} className="ui-fieldset">
          <div className="ui-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              value={form.username}
              placeholder="Your username"
              onChange={(event) => {
                setForm((previous) => ({
                  ...previous,
                  username: event.target.value,
                }));
                setErrors({});
              }}
              aria-invalid={!!errors.username}
              aria-describedby={
                errors.username ? "login-username-error" : undefined
              }
            />
            {errors.username && (
              <p id="login-username-error" className="ui-field-error">
                {errors.username}
              </p>
            )}
          </div>
          <PasswordField
            id="login-password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => {
              setForm((previous) => ({
                ...previous,
                password: event.target.value,
              }));
              setErrors({});
            }}
            error={errors.password}
          />
          <button
            type="button"
            className="auth-forgot"
            onClick={() => {
              setResetOpen(true);
              setReset((previous) => ({
                ...previous,
                username: form.username,
              }));
            }}
          >
            Forgot your password?
          </button>
          <button
            type="submit"
            className="ui-button ui-button-dark auth-submit"
          >
            {busy ? "Signing you in…" : "Sign in"}
            <Icon name="arrow" size={18} />
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        New to Old Goods?{" "}
        <Link to="/signup" state={state}>
          Create an account
        </Link>
      </p>
      {resetOpen && (
        <div
          className="auth-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !resetBusy)
              setResetOpen(false);
          }}
        >
          <section
            ref={modal}
            className="auth-recovery"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-title"
            tabIndex={-1}
          >
            <button
              className="auth-modal-close"
              aria-label="Close password recovery"
              onClick={() => setResetOpen(false)}
              disabled={resetBusy}
            >
              <Icon name="close" />
            </button>
            <span className="ui-eyebrow">A fresh start</span>
            <h2 id="recovery-title">
              {step === "done" ? "You’re all set." : "Let’s get you back in."}
            </h2>
            {step === "done" ? (
              <>
                <p>
                  Your password has been updated. Use your new password to sign
                  in.
                </p>
                <button
                  className="ui-button ui-button-dark"
                  onClick={() => {
                    setResetOpen(false);
                    setStep("request");
                    setReset({
                      username: "",
                      email: "",
                      token: "",
                      password: "",
                      confirm: "",
                    });
                  }}
                >
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <p>
                  {step === "request"
                    ? "Enter the username and email address on your account. We’ll send you a verification code."
                    : "Check your email for your code. It expires in 15 minutes."}
                </p>
                {resetMessage && (
                  <div className="ui-message success" role="status">
                    {resetMessage}
                  </div>
                )}
                {resetError && (
                  <div className="ui-message error" role="alert">
                    {resetError}
                  </div>
                )}
                <form onSubmit={resetSubmit} noValidate>
                  <fieldset className="ui-fieldset" disabled={resetBusy}>
                    <div className="ui-field">
                      <label htmlFor="reset-username">Username</label>
                      <input
                        id="reset-username"
                        autoComplete="username"
                        value={reset.username}
                        readOnly={step === "verify"}
                        onChange={(event) =>
                          setReset((previous) => ({
                            ...previous,
                            username: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor="reset-email">Email address</label>
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={reset.email}
                        readOnly={step === "verify"}
                        onChange={(event) =>
                          setReset((previous) => ({
                            ...previous,
                            email: event.target.value,
                          }))
                        }
                      />
                    </div>
                    {step === "verify" && (
                      <>
                        <div className="ui-field">
                          <label htmlFor="reset-code">
                            Email verification code
                          </label>
                          <input
                            id="reset-code"
                            autoComplete="one-time-code"
                            value={reset.token}
                            onChange={(event) =>
                              setReset((previous) => ({
                                ...previous,
                                token: event.target.value,
                              }))
                            }
                          />
                        </div>
                        <PasswordField
                          id="reset-password"
                          label="New password"
                          autoComplete="new-password"
                          value={reset.password}
                          hint="At least 8 characters."
                          onChange={(event) =>
                            setReset((previous) => ({
                              ...previous,
                              password: event.target.value,
                            }))
                          }
                        />
                        <PasswordField
                          id="reset-confirm"
                          label="Confirm new password"
                          autoComplete="new-password"
                          value={reset.confirm}
                          onChange={(event) =>
                            setReset((previous) => ({
                              ...previous,
                              confirm: event.target.value,
                            }))
                          }
                        />
                      </>
                    )}
                    <button
                      className="ui-button ui-button-dark auth-submit"
                      type="submit"
                    >
                      {resetBusy
                        ? "Please wait…"
                        : step === "request"
                          ? "Send verification code"
                          : "Update password"}
                    </button>
                    {step === "verify" && (
                      <button
                        className="auth-forgot"
                        type="button"
                        onClick={() => {
                          setStep("request");
                          setResetMessage("");
                          setResetError("");
                        }}
                      >
                        Use different details or request a new code
                      </button>
                    )}
                  </fieldset>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </AuthLayout>
  );
}
