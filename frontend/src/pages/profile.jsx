import Image from "../components/Image";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../services/http";
import { BACKEND_URL } from "../services/config";
import { validateAddress } from "../utils/address";
import CustomerLayout from "../components/CustomerLayout";
import AddressFields from "../components/AddressFields";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/Icon";
import "../styles/auth-pages.css";

const profileFields = (value) => ({
  firstName: value.firstName || "",
  lastName: value.lastName || "",
  phone: value.phone || "",
  gender: value.gender || "",
  dob: value.dob || "",
  profilePic: value.profilePic || "/default-avatar.svg",
});

export default function Profile() {
  const { user, updateUser } = useAuth();
  const userId = user?._id || user?.id;
  const [profile, setProfile] = useState(() => profileFields(user || {}));
  const [saved, setSaved] = useState(() => profileFields(user || {}));
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({});
  const [addressErrors, setAddressErrors] = useState({});
  const [removing, setRemoving] = useState(null);
  const photo = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setError("");
    (async () => {
      try {
        const response = await apiFetch(
          `${BACKEND_URL}/api/users/profile/${userId}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok || !data.user)
          throw new Error(
            data.error || "Your profile couldn’t be loaded. Please try again.",
          );
        setProfile(profileFields(data.user));
        setSaved(profileFields(data.user));
        setAddresses(
          (data.user.addresses || []).map((item) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
          })),
        );
        updateUser(data.user);
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError(failure.message);
          setLoadFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userId, retry, updateUser]);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const saveProfile = async (event) => {
    event.preventDefault();
    if (busy || !dirty) return;
    setError("");
    setMessage("");
    if (
      profile.phone &&
      !/^(09\d{9}|\+?639\d{9})$/.test(profile.phone.replace(/[\s()-]/g, ""))
    ) {
      setError(
        "Enter a valid Philippine mobile number, such as 0912 345 6789.",
      );
      document.getElementById("profile-phone")?.focus();
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(
        `${BACKEND_URL}/api/users/profile/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Your changes couldn’t be saved.");
      const updated = profileFields(data.user || profile);
      setProfile(updated);
      setSaved(updated);
      updateUser(data.user || profile);
      setMessage("Your profile has been updated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const changePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG, or WebP photo smaller than 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfile((previous) => ({ ...previous, profilePic: reader.result }));
      setMessage("Your new photo is ready. Save your changes to keep it.");
    };
    reader.onerror = () =>
      setError("The photo couldn’t be read. Please choose it again.");
    reader.readAsDataURL(file);
  };
  const persistAddresses = async (next) => {
    const response = await apiFetch(
      `${BACKEND_URL}/api/users/profile/${userId}/address`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: next }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "The address couldn’t be saved. Please try again.",
      );
    const saved = data.addresses || next;
    setAddresses(saved);
    updateUser({ addresses: saved });
  };
  const editAddress = (address) => {
    setEditingAddress(address?.id || "new");
    setAddressForm({
      title: address?.title || "Home",
      recipient:
        address?.recipient ||
        [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        user.username,
      contact: address?.contact || profile.phone,
      street: address?.street || "",
      barangay: address?.barangay || "",
      city: address?.city || "",
      province: address?.province || "",
      ...address,
    });
    setAddressErrors({});
    setError("");
    setMessage("");
  };
  const saveAddress = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = validateAddress(addressForm);
    if (!addressForm.title?.trim())
      validation.title = "Give this address a name, such as Home.";
    setAddressErrors(validation);
    const first = Object.keys(validation)[0];
    if (first) {
      document.getElementById(`account-address-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const isNew = editingAddress === "new";
      const value = {
        ...addressForm,
        id: isNew ? crypto.randomUUID() : editingAddress,
        isDefault: isNew ? addresses.length === 0 : !!addressForm.isDefault,
      };
      const next = isNew
        ? [...addresses, value]
        : addresses.map((item) => (item.id === editingAddress ? value : item));
      await persistAddresses(next);
      setEditingAddress(null);
      setMessage("Your delivery address has been saved.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const makeDefault = async (id) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await persistAddresses(
        addresses.map((item) => ({ ...item, isDefault: item.id === id })),
      );
      setMessage("Your default delivery address has been updated.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  const removeAddress = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let next = addresses.filter((item) => item.id !== removing.id);
      if (next.length && !next.some((item) => item.isDefault))
        next = next.map((item, index) => ({ ...item, isDefault: index === 0 }));
      await persistAddresses(next);
      setRemoving(null);
      setMessage("The delivery address has been removed.");
    } catch (failure) {
      setRemoving(null);
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <CustomerLayout>
      <div className="customer-heading">
        <div>
          <span className="ui-eyebrow">Your corner of the thrift</span>
          <h1>Your account</h1>
          <p>A few details to help your good finds get home.</p>
        </div>
        <Link to="/order-history" className="customer-back">
          View your orders <Icon name="arrow" size={16} />
        </Link>
      </div>
      {error && (
        <div className="ui-message error" role="alert">
          {error}
          {!addresses.length && !loading && (
            <button
              className="ui-button ui-button-light"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reload profile
            </button>
          )}
        </div>
      )}
      {message && (
        <div className="ui-message success" role="status">
          {message}
        </div>
      )}
      {loading ? (
        <div className="ui-empty" role="status">
          Getting your details ready…
        </div>
      ) : loadFailed ? (
        <div className="ui-empty">
          <h2>Your details are temporarily unavailable.</h2>
          <p>Reload your profile before making changes.</p>
          <button
            className="ui-button ui-button-dark"
            onClick={() => setRetry((value) => value + 1)}
          >
            Reload profile
          </button>
        </div>
      ) : (
        <div className="profile-columns">
          <aside className="profile-identity">
            <Image
              src={profile.profilePic}
              fallback="/default-avatar.svg"
              alt={`${user?.username || "Your"} profile`}
            />
            <h2>
              {[saved.firstName, saved.lastName].filter(Boolean).join(" ") ||
                user?.username}
            </h2>
            <p>@{user?.username}</p>
            <button
              className="ui-button ui-button-light"
              disabled={busy}
              onClick={() => photo.current.click()}
            >
              Change photo
            </button>
            <input
              ref={photo}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Choose a profile photo"
              onChange={changePhoto}
              disabled={busy}
            />
            <small>JPG, PNG or WebP · Up to 2 MB</small>
            <nav aria-label="Account sections">
              <a href="#profile-details">
                <Icon name="user" size={17} />
                Personal details
              </a>
              <a href="#delivery-addresses">
                <Icon name="truck" size={17} />
                Delivery addresses
              </a>
              <Link to="/order-history">
                <Icon name="orders" size={17} />
                Your orders
              </Link>
            </nav>
          </aside>
          <div>
            <section className="customer-panel" id="profile-details">
              <h2>The basics</h2>
              <p className="profile-section-intro">
                Keep these details up to date so we can reach you about your
                orders.
              </p>
              <form onSubmit={saveProfile}>
                <fieldset className="ui-fieldset" disabled={busy}>
                  <div className="profile-field-grid">
                    {[
                      ["firstName", "First name", "given-name"],
                      ["lastName", "Last name", "family-name"],
                    ].map(([key, label, autocomplete]) => (
                      <div className="ui-field" key={key}>
                        <label htmlFor={`profile-${key}`}>{label}</label>
                        <input
                          id={`profile-${key}`}
                          value={profile[key]}
                          maxLength={80}
                          autoComplete={autocomplete}
                          onChange={(event) =>
                            setProfile((previous) => ({
                              ...previous,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                    <div className="ui-field">
                      <label htmlFor="profile-email">Email address</label>
                      <input
                        id="profile-email"
                        type="email"
                        value={user?.email || ""}
                        readOnly
                      />
                      <p className="ui-field-hint">
                        Contact the store if you need to change your registered
                        email.
                      </p>
                    </div>
                    <div className="ui-field">
                      <label htmlFor="profile-phone">Mobile number</label>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={profile.phone}
                        maxLength={16}
                        autoComplete="tel"
                        placeholder="0912 345 6789"
                        onChange={(event) =>
                          setProfile((previous) => ({
                            ...previous,
                            phone: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor="profile-dob">
                        Birthday{" "}
                        <span className="field-optional">(optional)</span>
                      </label>
                      <input
                        id="profile-dob"
                        type="date"
                        value={profile.dob}
                        max={new Date().toLocaleDateString("en-CA")}
                        onChange={(event) =>
                          setProfile((previous) => ({
                            ...previous,
                            dob: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="ui-field">
                      <label htmlFor="profile-gender">
                        Gender{" "}
                        <span className="field-optional">(optional)</span>
                      </label>
                      <select
                        id="profile-gender"
                        value={profile.gender}
                        onChange={(event) =>
                          setProfile((previous) => ({
                            ...previous,
                            gender: event.target.value,
                          }))
                        }
                      >
                        <option value="">Prefer not to say</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Non-binary</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="profile-save-row">
                    <span role="status">
                      {dirty
                        ? "You have unsaved changes."
                        : "Your details are up to date."}
                    </span>
                    <button
                      className="ui-button ui-button-dark"
                      type="submit"
                      disabled={!dirty}
                    >
                      {busy ? "Saving…" : "Save changes"}
                      <Icon name="check" size={18} />
                    </button>
                  </div>
                </fieldset>
              </form>
            </section>
            <section className="customer-panel" id="delivery-addresses">
              <div className="customer-panel-heading">
                <h2>Your delivery addresses</h2>
                {!editingAddress && (
                  <button disabled={busy} onClick={() => editAddress(null)}>
                    Add address
                  </button>
                )}
              </div>
              {editingAddress ? (
                <form onSubmit={saveAddress} noValidate>
                  <div className="ui-field">
                    <label htmlFor="account-address-title">Address name</label>
                    <input
                      id="account-address-title"
                      value={addressForm.title}
                      disabled={busy}
                      onChange={(event) =>
                        setAddressForm((previous) => ({
                          ...previous,
                          title: event.target.value,
                        }))
                      }
                      placeholder="Home, work…"
                    />
                    {addressErrors.title && (
                      <p className="ui-field-error">{addressErrors.title}</p>
                    )}
                  </div>
                  <AddressFields
                    prefix="account-address"
                    value={addressForm}
                    errors={addressErrors}
                    disabled={busy}
                    onChange={(key, value) => {
                      setAddressForm((previous) => ({
                        ...previous,
                        [key]: value,
                      }));
                      setAddressErrors((previous) => ({
                        ...previous,
                        [key]: "",
                      }));
                    }}
                  />
                  <div className="profile-address-actions">
                    <button
                      type="button"
                      className="ui-button ui-button-light"
                      disabled={busy}
                      onClick={() => setEditingAddress(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="ui-button ui-button-dark"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save address"}
                    </button>
                  </div>
                </form>
              ) : addresses.length ? (
                <div className="profile-address-list">
                  {addresses.map((address, index) => (
                    <article key={address.id || index}>
                      <div>
                        <h3>
                          {address.title || "Delivery address"}
                          {address.isDefault ||
                          (!addresses.some((item) => item.isDefault) &&
                            index === 0) ? (
                            <span>Default</span>
                          ) : null}
                        </h3>
                        <p>
                          {address.recipient ||
                            [profile.firstName, profile.lastName]
                              .filter(Boolean)
                              .join(" ")}
                          <br />
                          {address.contact || profile.phone}
                          <br />
                          {address.street}, {address.barangay}
                          <br />
                          {address.city}, {address.province}
                        </p>
                      </div>
                      <div>
                        <button
                          disabled={busy}
                          onClick={() => editAddress(address)}
                        >
                          Edit
                        </button>
                        {!(
                          address.isDefault ||
                          (!addresses.some((item) => item.isDefault) &&
                            index === 0)
                        ) && (
                          <button
                            disabled={busy}
                            onClick={() => makeDefault(address.id)}
                          >
                            Set as default
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => setRemoving(address)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="profile-address-empty">
                  <Icon name="truck" size={28} />
                  <p>No address saved yet. Add one for a smoother checkout.</p>
                  <button
                    className="ui-button ui-button-light"
                    onClick={() => editAddress(null)}
                  >
                    Add your first address
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {removing && (
        <ConfirmDialog
          title="Remove this address?"
          description={`${removing.title || "This address"} will no longer be available for future checkouts. Addresses on existing orders will stay the same.`}
          confirmLabel="Remove address"
          busy={busy}
          onClose={() => setRemoving(null)}
          onConfirm={removeAddress}
        />
      )}
    </CustomerLayout>
  );
}
