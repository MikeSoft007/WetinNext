import { CatalogCollection, LocalCollection } from "../../shared/ui/Collection";
import SignOutButton from "../../shared/ui/SignOutButton";
import { useEffect, useState, type FormEvent } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Compass,
  Users,
  History,
  ShieldCheck,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { api } from "../../shared/api";
import {
  useSectionRoute,
  adminRoutes,
  sectionFor,
} from "../../app/useSectionRoute";
import LearnerIllustration from "../../shared/illustrations/LearnerIllustration";
type Item = Record<string, unknown> & {
  id: string;
  title: string;
  status: string;
};
type Learners = {
  total: number;
  check_ins: number;
  cv_reviews: number;
  learners: {
    id: string;
    name: string;
    country: string;
    learner_type: string;
    has_pathway: boolean;
    completed: number;
  }[];
};
const resource = {
  title: "",
  provider: "",
  url: "",
  format: "guide",
  device: "phone",
  cost: "free",
  review: "Review pending",
  skills: [],
};
const opportunity = {
  title: "",
  organisation: "",
  type: "Internship",
  country: "Nigeria",
  skills: [],
  description: "",
  mandatory: "",
  sample: true,
  url: null,
  deadline: null,
  deadline_unknown_confirmed: false,
};
export default function AdminWorkspace() {
  const [page, setPage] = useSectionRoute(adminRoutes);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [learners, setLearners] = useState<Learners | null>(null),
    [health, setHealth] = useState<Record<string, unknown>>({}),
    [editing, setEditing] = useState<Item | null>(null),
    [filter, setFilter] = useState(""),
    [visibility, setVisibility] = useState("all"),
    [feedback, setFeedback] = useState(""),
    [catalogue, setCatalogue] = useState<{
      resources: Item[];
      opportunities: Item[];
    }>({ resources: [], opportunities: [] });
  const [sources, setSources] = useState<
    {
      id: string;
      name: string;
      notice: string;
      docs: string;
      configured?: boolean;
      last_run: null | { result: string };
    }[]
  >([]);
  const [automatic, setAutomatic] = useState({
    enabled: false,
    interval_hours: 6,
    auto_publish: false,
  });
  const [demo, setDemo] = useState(false);
  const kind = page === "Resources" ? "resources" : "opportunities";
  function admin<T>(path: string, init?: RequestInit) {
    return api<T>("/admin" + path, {
      ...init,
      headers: { ...init?.headers },
    });
  }
  async function load(next: string) {
    setBusy(true);
    setError("");
    setEditing(null);
    setFilter("");
    setVisibility("all");
    try {
      if (next === "Sources") {
        const [s, a] = await Promise.all([
          admin<typeof sources>("/sources"),
          admin<typeof automatic>("/source-settings"),
        ]);
        setSources(s);
        setAutomatic(a);
      } else if (next === "Overview") {
        const [l, h, r, o] = await Promise.all([
          admin<Learners>("/learners"),
          api<Record<string, unknown>>("/health"),
          admin<Item[]>("/content/resources"),
          admin<Item[]>("/content/opportunities"),
        ]);
        setLearners(l);
        setHealth(h);
        setCatalogue({ resources: r, opportunities: o });
      }
      setPage(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void api<{ role: string }>("/auth/session").then((s) =>
      setDemo(s.role === "admin_demo"),
    );
    void load(page);
    const onBack = () => {
      void load(sectionFor(adminRoutes));
    };
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = { ...editing };
    Object.keys(page === "Resources" ? resource : opportunity).forEach(
      (field) => {
        const value = data.get(field);
        payload[field] =
          field === "skills"
            ? String(value)
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
            : field === "sample" || field === "deadline_unknown_confirmed"
              ? value === "true"
              : (field === "url" || field === "deadline") && !value
                ? null
                : value;
      },
    );
    try {
      await admin(
        `/content/${kind}/${encodeURIComponent(String(data.get("id")))}`,
        {
          method: "PUT",
          body: JSON.stringify({ status: data.get("status"), data: payload }),
        },
      );
      await load(page);
      setFeedback("Record saved. Learners see published records only.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const tabs = [
    { name: "Overview", icon: LayoutDashboard },
    { name: "Resources", icon: BookOpen },
    { name: "Opportunities", icon: Compass },
    { name: "Learners", icon: Users },
    { name: "Audit log", icon: History },
    { name: "Sources", icon: Compass },
  ];
  return (
    <div className="management-page admin-shell">
      <aside className="admin-nav">
        <a className="public-brand" href="/">
          WetinNext<span>.</span>
        </a>
        <span className="public-eyebrow">ADMIN WORKSPACE</span>
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            aria-current={page === name ? "page" : undefined}
            disabled={busy}
            onClick={() => load(name)}
          >
            <Icon size={18} />
            {name}
          </button>
        ))}
        <a href="/">Visit website ↗</a>
        <SignOutButton
          disabled={busy}
          onConfirm={async () => {
            await api("/auth/sign-out", { method: "POST" });
            sessionStorage.removeItem("wetinnext_access_token");
            location.assign("/sign-in");
          }}
        />
      </aside>
      <main className="management-main">
        <span className="public-eyebrow">DIRECTION, WITH CARE.</span>
        <h1>{page}</h1>
        <p className="management-intro">
          Keep guidance useful, sources traceable, and preparation honest.
        </p>
        {demo && (
          <section className="admin-feedback" role="status">
            <strong>Admin demo · read-only</strong>
            <p>
              Explore content, drafts and sources. Learner activity is
              fictional. Saves, publishing and imports require an administrator
              account.
            </p>
            <a className="text-link" href="/sign-in">
              Sign in as administrator ↗
            </a>
          </section>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        {busy && <p role="status">Updating workspace…</p>}
        {feedback && (
          <p className="admin-feedback" role="status">
            ✓ {feedback}
            <button
              aria-label="Dismiss save confirmation"
              onClick={() => setFeedback("")}
            >
              ×
            </button>
          </p>
        )}
        {page === "Sources" && (
          <section className="management-card">
            <h2>Automatic discovery</h2>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={automatic.enabled}
                disabled={busy || demo}
                onChange={async (e) => {
                  setBusy(true);
                  try {
                    setAutomatic(
                      await admin<typeof automatic>("/source-settings", {
                        method: "PUT",
                        body: JSON.stringify({ enabled: e.target.checked }),
                      }),
                    );
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              Load new jobs and resources automatically
            </label>
            <p>
              Checks every {automatic.interval_hours} hours while the catalogue
              service runs.
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={automatic.auto_publish}
                disabled={busy || demo}
                onChange={async (e) => {
                  setBusy(true);
                  try {
                    setAutomatic(
                      await admin<typeof automatic>("/source-settings", {
                        method: "PUT",
                        body: JSON.stringify({
                          enabled: automatic.enabled,
                          auto_publish: e.target.checked,
                        }),
                      }),
                    );
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
              Automatically publish imports that pass source checks
            </label>
            <p>
              Uncertain, senior and manually managed drafts stay in review.
              Publication checks do not guarantee employer eligibility.
            </p>
            <LocalCollection items={sources} label="sources" searchable={false}>
              {(visible) =>
                visible.map((source) => (
                  <article className="management-card" key={source.id}>
                    <h3>{source.name}</h3>
                    <p>{source.notice}</p>
                    <p>
                      {source.configured === false
                        ? "Setup needed: approved RELIEFWEB_APPNAME"
                        : source.last_run?.result || "Not imported yet"}
                    </p>
                    <a href={source.docs} target="_blank" rel="noreferrer">
                      Source documentation ↗
                    </a>
                    <p>
                      <button
                        className="public-button peach"
                        disabled={busy || demo || source.configured === false}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            const result = await admin<{ notice: string }>(
                              `/sources/${source.id}/sync`,
                              { method: "POST" },
                            );
                            await load("Sources");
                            setFeedback(result.notice);
                          } catch (e) {
                            setError((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Check now
                      </button>
                    </p>
                  </article>
                ))
              }
            </LocalCollection>
          </section>
        )}
        {page === "Overview" && (
          <>
            <section className="admin-welcome">
              <div>
                <span className="public-eyebrow">
                  GOOD GUIDANCE STARTS HERE.
                </span>
                <h2>
                  Make someone’s
                  <br />
                  next step clearer.
                </h2>
                <p>
                  Your editorial desk for useful resources, honest
                  opportunities, and a little more direction.
                </p>
                <div>
                  <button
                    className="public-button peach"
                    disabled={busy}
                    onClick={() => load("Opportunities")}
                  >
                    Curate opportunities ↗
                  </button>
                  <button
                    className="public-button"
                    disabled={busy}
                    onClick={() => load("Resources")}
                  >
                    Review resources
                  </button>
                </div>
              </div>
              <LearnerIllustration />
            </section>
            <div className="admin-editorial-grid">
              <button
                className="editorial-card"
                disabled={busy}
                onClick={() => {
                  void load("Resources").then(() => setVisibility("draft"));
                }}
              >
                <BookOpen size={22} />
                <strong>
                  {
                    catalogue.resources.filter((r) => r.status === "draft")
                      .length
                  }
                </strong>
                <span>Resource drafts</span>
                <small>Review your learning library ↗</small>
              </button>
              <button
                className="editorial-card peach-surface"
                disabled={busy}
                onClick={() => {
                  void load("Opportunities").then(() => setVisibility("draft"));
                }}
              >
                <Compass size={22} />
                <strong>
                  {
                    catalogue.opportunities.filter((r) => r.status === "draft")
                      .length
                  }
                </strong>
                <span>Opportunity drafts</span>
                <small>Check the source, then publish ↗</small>
              </button>
              <button
                className="editorial-card"
                disabled={busy}
                onClick={() => load("Learners")}
              >
                <Users size={22} />
                <strong>
                  {learners?.learners.filter((l) => l.has_pathway).length || 0}
                </strong>
                <span>Active pathways</span>
                <small>View learner activity ↗</small>
              </button>
            </div>
            <div className="admin-stats">
              {[
                ["Learners", learners?.total],
                ["Check-ins", learners?.check_ins],
                ["CV reviews", learners?.cv_reviews],
              ].map(([label, value]) => (
                <article className="management-card" key={String(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <section className="management-card">
              <h2>Platform configuration</h2>
              <a
                className="text-link"
                href="http://127.0.0.1:8000/api/v1/docs"
                target="_blank"
                rel="noreferrer"
              >
                REST API documentation ↗
              </a>
              <p>
                Identity:{" "}
                {health.demo_mode
                  ? "Local demo sessions"
                  : "Authenticated accounts"}
              </p>
              <p>
                OpenAI guidance:{" "}
                {health.ai_configured
                  ? "Configured"
                  : "Not configured · basic guidance"}
              </p>
              <p>
                Telegram:{" "}
                {health.telegram_bot_url ? "Configured" : "Not connected"}
              </p>
              <p>
                CV guidance: transparent text checks · original uploads not
                retained.
              </p>
              <p className="privacy-note">
                Publish only after reviewing source, dates, eligibility, and
                accuracy. Draft and archived records stay out of the learner
                catalogue.
              </p>
            </section>
          </>
        )}
        {(page === "Resources" || page === "Opportunities") && (
          <>
            {editing ? (
              <section className="management-card">
                <h2>{!!editing.id ? "Edit record" : "Add a record"}</h2>
                <form className="admin-edit" onSubmit={save} key={editing.id}>
                  <label>
                    Record ID
                    <input
                      name="id"
                      required
                      defaultValue={editing.id}
                      readOnly={!!editing.id}
                      pattern="[a-zA-Z0-9_-]+"
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Visibility
                    <select name="status" defaultValue={editing.status}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  {page === "Opportunities" && (
                    <div>
                      <p>
                        Availability:{" "}
                        {String(editing.availability || "unknown")} · Last
                        checked:{" "}
                        {editing.last_checked_at
                          ? new Date(
                              String(editing.last_checked_at),
                            ).toLocaleString()
                          : "Not yet checked"}
                      </p>
                      <p>
                        {String(
                          editing.last_check_result || "Source check pending",
                        )}
                      </p>
                      <p>
                        {String(editing.publication_note || "Editorial record")}
                      </p>
                      {!!editing.source_snapshot && (
                        <details>
                          <summary>Latest source facts for review</summary>
                          <p>
                            Automatic records follow source changes. Manually
                            edited copy stays intact; compare it with these
                            latest source facts.
                          </p>
                          <pre
                            style={{
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              fontSize: 12,
                            }}
                          >
                            {JSON.stringify(editing.source_snapshot, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                  {Object.keys(
                    page === "Resources" ? resource : opportunity,
                  ).map((field) => (
                    <label key={field}>
                      {field.replaceAll("_", " ")}
                      {field === "sample" ||
                      field === "deadline_unknown_confirmed" ? (
                        <select
                          name={field}
                          defaultValue={String(editing[field])}
                        >
                          <option value="true">
                            {field === "sample"
                              ? "Practice listing"
                              : "Reviewed: deadline not provided"}
                          </option>
                          <option value="false">
                            {field === "sample"
                              ? "Live opportunity"
                              : "Not confirmed"}
                          </option>
                        </select>
                      ) : field === "country" ? (
                        <select
                          name={field}
                          defaultValue={String(editing[field])}
                        >
                          <option>Nigeria</option>
                          <option>Rwanda</option>
                          <option>Other</option>
                          <option>Global</option>
                        </select>
                      ) : ["description", "mandatory", "review"].includes(
                          field,
                        ) ? (
                        <textarea
                          name={field}
                          defaultValue={String(editing[field] || "")}
                          maxLength={10000}
                        />
                      ) : (
                        <input
                          name={field}
                          type={
                            field === "url"
                              ? "url"
                              : field === "deadline"
                                ? "date"
                                : "text"
                          }
                          required={[
                            "title",
                            "provider",
                            "organisation",
                            "format",
                            "device",
                            "cost",
                          ].includes(field)}
                          defaultValue={
                            Array.isArray(editing[field])
                              ? (editing[field] as string[]).join(", ")
                              : String(editing[field] || "")
                          }
                          placeholder={
                            field === "skills" ? "React, HTML, CSS" : ""
                          }
                          maxLength={10000}
                        />
                      )}
                    </label>
                  ))}
                  <div className="admin-form-actions">
                    <button
                      className="public-button peach"
                      disabled={busy || demo}
                    >
                      Save record
                    </button>
                    <button
                      type="button"
                      className="public-button"
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <>
                <div className="admin-toolbar">
                  <input
                    aria-label="Filter catalogue"
                    placeholder="Search titles, skills, providers…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <select
                    aria-label="Filter visibility"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                  >
                    <option value="all">All visibility states</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                  <button
                    className="public-button peach"
                    disabled={demo}
                    onClick={() =>
                      setEditing({
                        ...(page === "Resources" ? resource : opportunity),
                        id: "",
                        title: "",
                        status: "draft",
                      })
                    }
                  >
                    <Plus size={16} />
                    Add {page === "Resources" ? "resource" : "opportunity"}
                  </button>
                </div>
                <CatalogCollection<Item>
                  kind={kind}
                  admin
                  query={filter}
                  status={visibility}
                  refreshToken={busy}
                >
                  {(visible) => (
                    <div className="management-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Record ID</th>
                            <th>Visibility</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((i) => (
                            <tr key={i.id}>
                              <td>{i.title}</td>
                              <td>{i.id}</td>
                              <td>
                                <span className="admin-status">{i.status}</span>
                              </td>
                              <td>
                                <button
                                  className="text-link"
                                  onClick={() => setEditing(i)}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CatalogCollection>
              </>
            )}
          </>
        )}
        {page === "Learners" && (
          <>
            <p>
              Learner directory. CV contents and private reflections are
              excluded.
            </p>
            <label className="collection-search">
              <input
                aria-label="Search learners"
                type="search"
                maxLength={100}
                placeholder="Search learners…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <CatalogCollection<Learners["learners"][number]>
              endpoint="/admin/learners"
              kind="resources"
              admin
              query={filter}
            >
              {(visible) => (
                <div className="management-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Market</th>
                        <th>Type</th>
                        <th>Pathway</th>
                        <th>Completed weeks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((l) => (
                        <tr key={l.id}>
                          <td>{l.name}</td>
                          <td>{l.country}</td>
                          <td>{l.learner_type}</td>
                          <td>{l.has_pathway ? "Created" : "Not started"}</td>
                          <td>{l.completed}/4</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CatalogCollection>
          </>
        )}
        {page === "Audit log" && (
          <section className="management-card">
            <h2>Catalogue changes</h2>
            <p>Changes made by administrators and automatic source checks.</p>
            <label className="collection-search">
              <input
                aria-label="Search audit changes"
                type="search"
                maxLength={100}
                placeholder="Search audit changes…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <CatalogCollection<Record<string, string>>
              endpoint="/admin/audit"
              kind="resources"
              admin
              query={filter}
            >
              {(visible) =>
                visible.map((a) => (
                  <div className="audit-entry" key={a.id}>
                    <strong>{a.action}</strong>
                    <span>
                      {a.kind} · {a.content_id}
                    </span>
                    <time>{new Date(a.at).toLocaleString()}</time>
                  </div>
                ))
              }
            </CatalogCollection>
          </section>
        )}
      </main>
    </div>
  );
}
