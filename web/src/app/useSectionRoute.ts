import { useEffect, useState } from "react";
export const learnerRoutes: Record<string, string> = {
  Discover: "/app/discover",
  Today: "/app",
  Review: "/app/review",
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
  if (routes === learnerRoutes && location.pathname === "/cv") return "Review";
  if (routes === learnerRoutes && location.pathname === "/app")
    return "Discover";
  return (
    Object.keys(routes).find((key) => routes[key] === location.pathname) ||
    Object.keys(routes)[0]
  );
}
export function useSectionRoute(
  routes: Record<string, string>,
): [string, (section: string) => void] {
  const [section, setSection] = useState(() => sectionFor(routes));
  const [, setLocation] = useState(() => location.href);
  useEffect(() => {
    const change = () => {
      setSection(sectionFor(routes));
      setLocation(location.href);
    };
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

export function navigateApp(
  path: string,
  options: { preserveScroll?: boolean } = {},
) {
  history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (!options.preserveScroll) window.scrollTo(0, 0);
}
