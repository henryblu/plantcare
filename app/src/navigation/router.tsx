import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
} from "react";

export type RoutePath = "/" | "/add" | "/settings";
export type RouteName = "home" | "add" | "settings";

const NAVIGATION_EVENT = "plantcare:navigation";

interface NavigationSnapshot {
  route: RouteName;
  pathname: RoutePath;
  search: string;
}

const DEFAULT_SNAPSHOT: NavigationSnapshot = {
  route: "home",
  pathname: "/",
  search: "",
};

let lastSnapshot: NavigationSnapshot = DEFAULT_SNAPSHOT;

const isBrowser = typeof window !== "undefined";

const getRouteName = (pathname: string): NavigationSnapshot["route"] => {
  switch (pathname) {
    case "/add":
      return "add";
    case "/settings":
      return "settings";
    case "/":
    default:
      return "home";
  }
};

const readSnapshot = (): NavigationSnapshot => {
  if (!isBrowser) {
    return DEFAULT_SNAPSHOT;
  }
  const { pathname, search } = window.location;
  const normalizedPathname: RoutePath = pathname === "/add" || pathname === "/settings" ? pathname : "/";
  if (lastSnapshot.pathname === normalizedPathname && lastSnapshot.search === search) {
    return lastSnapshot;
  }
  lastSnapshot = {
    route: getRouteName(normalizedPathname),
    pathname: normalizedPathname,
    search,
  };
  return lastSnapshot;
};

type NavigationListener = () => void;

const subscribeToNavigation = (listener: NavigationListener) => {
  if (!isBrowser) {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener("popstate", handler);
  window.addEventListener(NAVIGATION_EVENT, handler);
  return () => {
    window.removeEventListener("popstate", handler);
    window.removeEventListener(NAVIGATION_EVENT, handler);
  };
};

const dispatchNavigation = () => {
  if (!isBrowser) return;
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
};

const navigateInternal = (to: string, replace = false) => {
  if (!isBrowser) return;
  const method: "pushState" | "replaceState" = replace ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", to);
  dispatchNavigation();
};

export const useAppLocation = (): NavigationSnapshot =>
  useSyncExternalStore(subscribeToNavigation, readSnapshot, () => DEFAULT_SNAPSHOT);

export interface NavigateOptions {
  replace?: boolean;
}

export const useNavigation = () => {
  const location = useAppLocation();

  const navigate = useCallback((to: string, options: NavigateOptions = {}) => {
    navigateInternal(to, Boolean(options.replace));
  }, []);

  const buildPath = useCallback(
    (pathname: RoutePath, search = "") => {
      if (!search) return pathname;
      return `${pathname}?${search.replace(/^\?/, "")}`;
    },
    [],
  );

  return useMemo(
    () => ({
      location,
      navigate,
      buildPath,
    }),
    [location, navigate, buildPath],
  );
};

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
}

const isModifiedEvent = (event: MouseEvent<HTMLAnchorElement>) =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;

export const Link = ({ to, replace, onClick, ...rest }: LinkProps) => {
  const { navigate } = useNavigation();

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || isModifiedEvent(event)) {
        return;
      }
      event.preventDefault();
      navigate(to, { replace });
    },
    [navigate, onClick, replace, to],
  );

  return <a {...rest} href={to} onClick={handleClick} />;
};
