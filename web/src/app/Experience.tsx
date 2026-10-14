import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Sprout,
  Route,
  Compass,
  Target,
  ArrowUpRight,
} from "lucide-react";
import App from "../features/learner/LearnerWorkspace";
import { api } from "../shared/api";
import LearnerIllustration from "../shared/illustrations/LearnerIllustration";
import "../styles/experience.css";
import "../styles/management.css";
import PublicOpportunities from "../features/discovery/PublicOpportunities";
import CVWorkspace from "../features/cv/CVWorkspace";
import AdminWorkspace from "../features/admin/AdminWorkspace";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
function Brand() {
  return (
    <a className="public-brand" href="/">
      <Sprout size={25} />
      WetinNext<span>.</span>
    </a>
  );
}
export default function Experience() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const change = () => setPath(location.pathname);
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, []);
  useEffect(() => {
    if (path !== "/") return;
    const nodes = document.querySelectorAll(
      ".public-section, .audience-section, .closing-section",
    );
    if (
      !window.IntersectionObserver ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    nodes.forEach((node) => {
      node.classList.add("scroll-reveal");
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, [path]);
  async function go(next: string) {
    if (next === "/demo") {
      await api("/auth/sign-out", { method: "POST" });
      sessionStorage.removeItem("wetinnext_access_token");
      const demo = await api<{ password: string }>("/auth/demo-accounts");
      await api("/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({
          email: "ada@wetinnext.local",
          password: demo.password,
        }),
      });
      next = "/app";
    }
    history.pushState({}, "", next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  if (path === "/opportunities") return <PublicOpportunities />;
  if (path === "/admin-demo") return <AdminDemoEntry go={go} />;
  if (path === "/admin" || path.startsWith("/admin/"))
    return (
      <RoleGate go={go}>
        <AdminWorkspace />
      </RoleGate>
    );
  if (path === "/reset-password") return <ResetPassword go={go} />;
  if (path === "/cv" || path === "/app" || path.startsWith("/app/"))
    return (
      <LearnerGate go={go}>
        <App
          onSignOut={async () => {
            await api("/auth/sign-out", { method: "POST" });
            sessionStorage.removeItem("wetinnext_access_token");
            await go("/sign-in");
          }}
        />
      </LearnerGate>
    );
  if (["/sign-in", "/sign-up", "/forgot-password"].includes(path))
    return <Auth path={path} go={go} />;
  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <nav aria-label="Website navigation">
          <a href="#how-it-works">How it works</a>
          <a href="/opportunities">Browse opportunities</a>
          <button onClick={() => go("/sign-in")}>Sign in</button>
          <button
            className="public-button peach"
            onClick={() => go("/sign-up")}
          >
            Find my next step <ArrowUpRight size={16} />
          </button>
        </nav>
      </header>
      <main>
        <section className="landing-hero illustrated-hero">
          <div className="hero-copy reveal">
            <span className="public-eyebrow">
              LEARNING. OPPORTUNITY. YOUR NEXT STEP.
            </span>
            <h1>
              Your next big
              <br />
              step starts <em>here.</em>
            </h1>
            <p>
              Find useful resources and opportunities, then build a learning
              plan around your goal, time and starting point.
            </p>
            <button
              className="public-button peach"
              onClick={() => go("/sign-up")}
            >
              Find my next step <ArrowRight size={18} />
            </button>
            <div className="hero-markets">
              Made for real life. <span>🇳🇬 Nigeria</span>
              <span>🇷🇼 Rwanda</span>
            </div>
          </div>
          <div className="illustration-stage">
            <LearnerIllustration />
            <div className="illustration-caption">
              <span /> A little progress. A bigger possibility.
            </div>
          </div>
        </section>
        <div className="promise-strip">
          <span>Free learning resources</span>
          <span>Low-data friendly</span>
          <span>Built around your time</span>
          <span>Honest skill-gap guidance</span>
        </div>
        <section className="public-section" id="how-it-works">
          <div className="section-intro">
            <span className="public-eyebrow">LESS GUESSWORK. MORE GOING.</span>
            <h2>
              From “where do I start?”
              <br />
              to “I know wetin next.”
            </h2>
            <p>A clear direction, one doable week at a time.</p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: Route,
                n: "01",
                title: "Start where you are.",
                text: "Tell us your goal, current skills, and what real life allows. A few hours and a phone are a valid starting point.",
              },
              {
                icon: Target,
                n: "02",
                title: "Make your next move.",
                text: "Follow a 4-week pathway with free resources and practical tasks. Check in when you make progress or need a different pace.",
              },
              {
                icon: Compass,
                n: "03",
                title: "Connect the dots.",
                text: "Compare your skills with opportunity requirements. See the gaps, prepare useful evidence, and present your experience honestly.",
              },
            ].map(({ icon: Icon, n, title, text }) => (
              <article className="feature-card" key={n}>
                <div>
                  <Icon size={27} />
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="audience-section" id="built-for-you">
          <div>
            <span className="public-eyebrow">DIRECTION OVER PRESSURE.</span>
            <h2>
              A plan that fits
              <br />
              your actual life.
            </h2>
            <p>
              For university students finding their direction and self-taught
              learners building their own way forward.
            </p>
            <div className="audience-pills">
              <span>Limited time</span>
              <span>Small budget</span>
              <span>Phone or laptop</span>
              <span>Your starting point</span>
            </div>
          </div>
          <div className="paper-note">
            <span>YOUR PATH DOESN’T HAVE TO BE PERFECT.</span>
            <h3>
              It just needs
              <br />a next step.
            </h3>
            <Sprout size={55} />
            <p>
              Learn a little. Build something.
              <br />
              Keep going.
            </p>
          </div>
        </section>
        <section className="closing-section">
          <span className="public-eyebrow">READY WHEN YOU ARE.</span>
          <h2>So, wetin next?</h2>
          <p>Let’s turn that question into a plan.</p>
          <button
            className="public-button peach"
            onClick={() => go("/sign-up")}
          >
            Start my pathway <ArrowRight size={18} />
          </button>
          <small>
            Real source listings and clearly labelled practice examples.
          </small>
        </section>
      </main>
      <footer className="public-footer">
        <Brand />
        <span>Know where you are. Know wetin next.</span>
        <a href="/opportunities">Public opportunities ↗</a>
        <a href="/app">Explore the workspace ↗</a>
      </footer>
    </div>
  );
}
function Auth({ path, go }: { path: string; go: (p: string) => void }) {
  const signup = path === "/sign-up",
    reset = path === "/forgot-password";
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setMessage("");
    setError("");
  }, [path]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const fields = new FormData(e.currentTarget);
    setBusy(true);
    try {
      if (
        !url ||
        !key ||
        String(fields.get("email") || "")
          .toLowerCase()
          .endsWith("@wetinnext.local")
      ) {
        if (signup || reset)
          throw Error(
            "Account creation and password recovery need a configured account provider. Sign in with a saved local account.",
          );
        await api("/auth/sign-in", {
          method: "POST",
          body: JSON.stringify({
            email: fields.get("email"),
            password: fields.get("password"),
          }),
        });
        const session = await api<{ role: string }>("/auth/session");
        go(session.role === "admin" ? "/admin" : "/app");
        return;
      }
      const endpoint = reset
        ? "recover"
        : signup
          ? "signup"
          : "token?grant_type=password";
      const response = await fetch(
        `${url}/auth/v1/${endpoint}${reset ? `?redirect_to=${encodeURIComponent(location.origin + "/reset-password")}` : ""}`,
        {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: fields.get("email"),
            ...(!reset ? { password: fields.get("password") } : {}),
            ...(signup ? { data: { full_name: fields.get("name") } } : {}),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw Error(
          data.msg ||
            data.error_description ||
            data.message ||
            "Unable to continue. Please try again.",
        );
      if (reset)
        setMessage("Check your inbox for password-reset instructions.");
      else if (data.access_token) {
        sessionStorage.setItem("wetinnext_access_token", data.access_token);
        const session = await api<{ role: string }>("/auth/session");
        go(session.role === "admin" ? "/admin" : "/app");
      } else
        setMessage("Check your email to confirm your account, then sign in.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to connect. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="public-eyebrow">YOUR OWN WAY FORWARD.</span>
          <h1>
            A little direction.
            <br />A bigger possibility.
          </h1>
          <p>
            You don’t need to have it all figured out.
            <br />
            Let’s start with your next step.
          </p>
          <LearnerIllustration />
        </div>
        <span>Made around real life · Nigeria & Rwanda</span>
      </aside>
      <main className="auth-main">
        <a className="auth-home" href="/">
          ← Back to home
        </a>
        <div className="auth-form-wrap" key={path}>
          <span className="public-eyebrow">
            {reset
              ? "LET’S GET YOU BACK ON TRACK."
              : signup
                ? "A NEW CHAPTER STARTS HERE."
                : "GOOD TO HAVE YOU BACK."}
          </span>
          <h1>
            {reset
              ? "Forgot your password?"
              : signup
                ? "Find your way forward."
                : "Your next step is waiting."}
          </h1>
          <p>
            {reset
              ? "Enter your email and we’ll send reset instructions."
              : signup
                ? "Create your account. Build a pathway that fits you."
                : "Sign in to continue your learning journey."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  placeholder="What should we call you?"
                  maxLength={80}
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            {!reset && (
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete={signup ? "new-password" : "current-password"}
                  required
                  placeholder={
                    signup ? "At least 8 characters" : "Enter your password"
                  }
                />
              </label>
            )}
            {!signup && !reset && (
              <button
                className="text-link forgot-link"
                type="button"
                onClick={() => go("/forgot-password")}
              >
                Forgot password?
              </button>
            )}
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="auth-success" role="status">
                {message}
              </p>
            )}
            <button className="public-button peach auth-submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : reset
                  ? "Send reset instructions"
                  : signup
                    ? "Create my account"
                    : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {signup
              ? "Already have an account?"
              : reset
                ? "Remember your password?"
                : "New to WetinNext?"}{" "}
            <button
              className="text-link"
              onClick={() => go(signup || reset ? "/sign-in" : "/sign-up")}
            >
              {signup || reset ? "Sign in" : "Create an account"}
            </button>
          </p>
          {!signup && !reset && (
            <div className="demo-access">
              <SeededAccounts go={go} />
            </div>
          )}
        </div>
        <span className="auth-bottom">Small steps count. Keep going.</span>
      </main>
    </div>
  );
}

function ResetPassword({ go }: { go: (path: string) => void }) {
  const [token] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const value =
      params.get("type") === "recovery" ? params.get("access_token") : null;
    history.replaceState({}, "", location.pathname);
    return value;
  });
  const [error, setError] = useState(""),
    [done, setDone] = useState(false),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token || !url || !key) return;
    const password = new FormData(e.currentTarget).get("password");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${url}/auth/v1/user`, {
        method: "PUT",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      if (!res.ok)
        throw Error("This reset link may have expired. Request a new one.");
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reset password. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <Brand />
        <div>
          <h1>
            A fresh start.
            <br />
            Your next step.
          </h1>
          <LearnerIllustration />
        </div>
        <span>Made around real life · Nigeria & Rwanda</span>
      </aside>
      <main className="auth-main">
        <a className="auth-home" href="/">
          ← Back to home
        </a>
        <div className="auth-form-wrap">
          <h1>Choose a new password.</h1>
          {done ? (
            <>
              <p role="status">Your password has been updated.</p>
              <button
                className="public-button peach"
                onClick={() => go("/sign-in")}
              >
                Back to sign in
              </button>
            </>
          ) : token ? (
            <form onSubmit={save}>
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  placeholder="At least 8 characters"
                />
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button className="public-button peach" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : (
            <>
              <p>This reset link is missing or invalid.</p>
              <button
                className="public-button"
                onClick={() => go("/forgot-password")}
              >
                Request a new link
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function RoleGate({
  go,
  children,
}: {
  go: (path: string) => void;
  children: React.ReactNode;
}) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ role: string; id?: string }>("/auth/session")
      .then((s) => {
        if (!active) return;
        if (s.role === "admin" || s.role === "admin_demo") setAllowed(true);
        else go(s.id ? "/app" : "/sign-in");
      })
      .catch(() => {
        if (active) go("/sign-in");
      });
    return () => {
      active = false;
    };
  }, []);
  return allowed ? (
    children
  ) : (
    <main className="admin-gate">
      <p role="status">Checking your workspace…</p>
    </main>
  );
}

function LearnerGate({
  go,
  children,
}: {
  go: (path: string) => void;
  children: React.ReactNode;
}) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ role: string }>("/auth/session")
      .then((s) => {
        if (!active) return;
        if (s.role === "admin" || s.role === "admin_demo") go("/admin");
        else setAllowed(true);
      })
      .catch(() => {
        if (active) go("/sign-in");
      });
    return () => {
      active = false;
    };
  }, []);
  return allowed ? (
    children
  ) : (
    <main className="admin-gate">
      <p role="status">Opening your learning workspace…</p>
    </main>
  );
}

function AdminDemoEntry({ go }: { go: (path: string) => void }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/auth/admin-demo", { method: "POST" })
      .then(() => {
        if (active) {
          sessionStorage.removeItem("wetinnext_access_token");
          go("/admin");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="admin-gate">
      <Brand />
      <h1>Explore the admin workspace</h1>
      <p role={error ? "alert" : "status"}>
        {error || "Opening your read-only preview…"}
      </p>
      {error && (
        <button className="public-button" onClick={() => go("/sign-in")}>
          Back to sign in
        </button>
      )}
    </main>
  );
}

function SeededAccounts({ go }: { go: (path: string) => void }) {
  const [data, setData] = useState<{
      accounts: {
        email: string;
        name: string;
        role: string;
        country?: string;
      }[];
      password: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<NonNullable<typeof data>>("/auth/demo-accounts")
      .then((next) => {
        if (active) setData(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  async function open(email: string) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      sessionStorage.removeItem("wetinnext_access_token");
      await api("/auth/sign-out", { method: "POST" });
      const session = await api<{ role: string }>("/auth/sign-in", {
        method: "POST",
        body: JSON.stringify({ email, password: data.password }),
      });
      await go(session.role === "admin" ? "/admin" : "/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data) return null;
  return (
    <details className="seeded-accounts">
      <summary>Use a saved demo account</summary>
      <p>Each account keeps its own goals and activity.</p>
      {data.accounts.map((account) => (
        <button
          key={account.email}
          className="public-button"
          disabled={busy}
          onClick={() => void open(account.email)}
        >
          {account.name} · {account.country || "Admin"}{" "}
          <ArrowUpRight size={14} />
        </button>
      ))}
      <small>Shared local demo accounts · sample activity</small>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
