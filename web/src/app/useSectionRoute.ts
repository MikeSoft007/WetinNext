import { useEffect, useState } from "react";
export const learnerRoutes: Record<string, string> = {
  Today: "/app",
  Discover: "/app/discover",
  "Opportunity fit": "/app/match",
  Progress: "/app/progress",
  Settings: "/app/settings",
};
export const adminRoutes: Record<string, string> = {
  Overview: "/admin",
  Resources: "/admin/resources",
  Opportunities: "/admin/opportunities",
  Learners: "/admin/learners",
  "Audit log": "/admin/audit",
  Sources: "/admin/sources",
};
export function sectionFor(routes: Record<string, string>) {
  return (
    Object.keys(routes).find((key) => routes[key] === location.pathname) ||
    Object.keys(routes)[0]
  );
}
export function useSectionRoute(
  routes: Record<string, string>,
): [string, (section: string) => void] {
  const [section, setSection] = useState(() => sectionFor(routes));
  useEffect(() => {
    const change = () => setSection(sectionFor(routes));
    window.addEventListener("popstate", change);
    return () => window.removeEventListener("popstate", change);
  }, [routes]);
  return [
    section,
    (next) => {
      const path = routes[next];
      if (!path) return;
      if (location.pathname !== path) history.pushState({}, "", path);
      setSection(next);
      window.scrollTo(0, 0);
    },
  ];
}

export function navigateApp(path: string) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
