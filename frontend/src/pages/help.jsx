import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import CustomerLayout from "../components/CustomerLayout";
import Icon from "../components/Icon";
import Skeleton from "../components/Skeleton";
import usePublicContent from "../hooks/usePublicContent";
import { helpLinks, policySections } from "../utils/help";

function ContentState({ error, reload, children }) {
  return error ? (
    <div className="ui-message error my-6" role="alert">
      <p>{error}</p>
      <button className="ui-button ui-button-light mt-3" onClick={reload}>
        Try again
      </button>
    </div>
  ) : (
    children
  );
}

function PolicyDocument({ kind }) {
  const { data, error, reload } = usePublicContent(`/policies/${kind}`);
  const policy = data?.policy;
  return (
    <section
      id={kind}
      className="scroll-mt-6 rounded-2xl border border-line bg-white p-5 sm:p-8"
    >
      <ContentState error={error} reload={reload}>
        {!policy ? (
          <div role="status">
            <span className="sr-only">Loading policy</span>
            <Skeleton className="h-8 w-2/3 mb-6" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : (
          <>
            <h2 className="font-serif text-2xl sm:text-3xl leading-tight">
              {policy.title}
            </h2>
            <p className="my-4 text-small text-muted">
              Updated{" "}
              <time dateTime={policy.publishedAt}>
                {new Date(policy.publishedAt).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </p>
            <div className="whitespace-pre-wrap break-words text-body leading-relaxed text-ink">
              {policy.body}
            </div>
          </>
        )}
      </ContentState>
    </section>
  );
}

function HelpCards({ sections = policySections }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => (
        <Link
          key={section.kind}
          to={section.path}
          className="group rounded-2xl border border-line bg-white p-6 transition hover:border-primary hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Icon
            name={section.icon}
            size={24}
            className="mb-5 rounded-xl bg-sage p-2 text-primary box-content"
          />
          <h2 className="text-lead font-semibold">{section.title}</h2>
          <p className="my-3 text-body leading-relaxed text-muted">
            {section.description}
          </p>
          <span className="inline-flex min-h-11 items-center gap-2 text-body font-semibold text-primary">
            Read more <Icon name="arrow" size={17} />
          </span>
        </Link>
      ))}
    </div>
  );
}

function Faqs() {
  const { data, error, reload } = usePublicContent("/content/faqs");
  const [search, setSearch] = useState("");
  const items = data?.content.data || [];
  const visible = items.filter((item) =>
    `${item.question} ${item.answer}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <ContentState error={error} reload={reload}>
      <div className="ui-field mb-6 max-w-2xl">
        <label htmlFor="faq-search">Search questions</label>
        <input
          id="faq-search"
          type="search"
          placeholder="Try payment, shipping or tracking"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          maxLength={200}
        />
      </div>
      {!data ? (
        <div role="status">
          <span className="sr-only">Loading frequently asked questions</span>
          {[1, 2, 3, 4].map((value) => (
            <Skeleton key={value} className="h-20 w-full mb-4 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <p className="mb-4 text-small text-muted" role="status">
            {visible.length} {visible.length === 1 ? "question" : "questions"}
            {search.trim() ? " found" : ""}
          </p>
          {visible.length ? (
            <div className="space-y-3">
              {visible.map((item) => (
                <details
                  key={item.id}
                  className="group rounded-xl border border-line bg-white open:border-primary/50 open:bg-sage/30 px-5 sm:px-6"
                  open={search.trim() ? true : undefined}
                >
                  <summary className="cursor-pointer py-5 pr-2 text-body font-semibold text-primary break-words">
                    {item.question}
                  </summary>
                  <p className="pb-6 whitespace-pre-wrap break-words text-body leading-relaxed text-muted">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          ) : (
            <div className="ui-empty">
              <h2>No matching questions</h2>
              <p>Try another search, or contact the store for help.</p>
              <button
                className="ui-button ui-button-light"
                onClick={() => setSearch("")}
              >
                Clear search
              </button>
            </div>
          )}
        </>
      )}
    </ContentState>
  );
}

function Contact() {
  const { data, error, reload } = usePublicContent("/content/support");
  const info = data?.content.data;
  return (
    <ContentState error={error} reload={reload}>
      {!info ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="text-lead font-semibold">Talk to the store</h2>
            <p className="my-4 whitespace-pre-wrap break-words text-body leading-relaxed text-muted">
              {info.message}
            </p>
            <a
              className="ui-button ui-button-dark mb-3 max-w-full break-all"
              href={`mailto:${encodeURIComponent(info.email)}`}
            >
              Email us <Icon name="arrow" size={17} />
            </a>
            <p className="mb-4 break-all text-body">{info.email}</p>
            <a
              className="ui-button ui-button-light"
              href={`tel:${info.phone.replace(/[^+\d]/g, "")}`}
            >
              Call {info.phone}
            </a>
          </section>
          <section className="rounded-2xl border border-line bg-primary-soft p-6 sm:p-8">
            <Icon name="leaf" size={28} className="text-primary" />
            <h2 className="mt-5 text-lead font-semibold">Here to help</h2>
            <dl className="mt-5 space-y-5 text-body leading-relaxed">
              <div>
                <dt className="font-semibold">Support hours</dt>
                <dd className="mt-1 text-muted [overflow-wrap:anywhere]">
                  {info.hours}
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Based in</dt>
                <dd className="mt-1 text-muted [overflow-wrap:anywhere]">
                  {info.location}
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-body text-muted">
              For an existing purchase, your order reference helps us find the
              right details.
            </p>
            <Link
              className="ui-button ui-button-light mt-5"
              to="/order-history"
            >
              Your orders <Icon name="arrow" size={17} />
            </Link>
          </section>
        </div>
      )}
    </ContentState>
  );
}

export default function HelpPage() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash === "#account" || hash === "#order")
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView({ block: "start" });
  }, [pathname, hash]);
  const { kind } = useParams();
  const selected = policySections.find(
    (section) => section.kind === kind && !["account", "order"].includes(kind),
  );
  const isTerms = pathname === "/terms";
  const title =
    pathname === "/faqs"
      ? "Frequently asked questions"
      : isTerms
        ? "Terms & conditions"
        : pathname === "/contact"
          ? "A little help, when you need it."
          : pathname.startsWith("/policies")
            ? selected?.title || "Store policies"
            : "Let’s make things clear.";
  return (
    <CustomerLayout>
      <header className="help-page-heading">
        <h1 className="my-4 font-serif text-4xl sm:text-5xl leading-tight">
          {title}
        </h1>
        <p className="max-w-2xl text-body leading-relaxed text-muted">
          Straightforward answers for your account, your finds and their journey
          to you.
        </p>
      </header>
      <nav className="help-navigation" aria-label="Help navigation">
        {helpLinks.map(([path, label]) => (
          <NavLink
            key={path}
            to={path}
            end={path !== "/policies"}
            className={({ isActive }) =>
              `help-navigation-link${isActive ? " is-active" : ""}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      {pathname === "/faqs" ? (
        <Faqs />
      ) : pathname === "/contact" ? (
        <Contact />
      ) : isTerms ? (
        <div className="space-y-6">
          <PolicyDocument kind="account" />
          <PolicyDocument kind="order" />
          <Link to="/policies/privacy" className="ui-button ui-button-light">
            Read our privacy policy <Icon name="arrow" size={17} />
          </Link>
        </div>
      ) : kind ? (
        selected ? (
          <PolicyDocument key={kind} kind={kind} />
        ) : (
          <div className="ui-empty">
            <h2>Policy not found</h2>
            <Link className="ui-button ui-button-dark" to="/policies">
              View store policies
            </Link>
          </div>
        )
      ) : (
        <>
          {pathname === "/help" && (
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <Link
                to="/faqs"
                className="rounded-2xl bg-primary p-6 text-white"
              >
                <h2 className="text-2xl sm:text-3xl font-serif">
                  Start with the FAQs
                </h2>
                <p className="my-4 text-body text-white/85">
                  Answers about payments, shipping, stock and order tracking.
                </p>
                <span className="inline-flex min-h-11 items-center gap-2 font-semibold">
                  Find an answer <Icon name="arrow" size={17} />
                </span>
              </Link>
              <Link
                to="/contact"
                className="rounded-2xl border border-line bg-primary-soft p-6"
              >
                <h2 className="text-2xl sm:text-3xl font-serif">
                  Ask the store
                </h2>
                <p className="my-4 text-body text-muted">
                  Have a question about an order or a piece you love?
                </p>
                <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary">
                  Get in touch <Icon name="arrow" size={17} />
                </span>
              </Link>
            </div>
          )}
          <HelpCards />
        </>
      )}
      {!["/contact", "/help"].includes(pathname) && (
        <aside className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-primary-soft p-6">
          <div>
            <h2 className="text-lead font-semibold">Still have a question?</h2>
            <p className="mt-2 text-body text-muted">
              The store can help with your account, payment or order.
            </p>
          </div>
          <Link to="/contact" className="ui-button ui-button-dark">
            Contact us <Icon name="arrow" size={17} />
          </Link>
        </aside>
      )}
    </CustomerLayout>
  );
}
