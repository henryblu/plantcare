import { memo } from "react";
import { Link, useAppLocation } from "@app/navigation/router";

const HomeIcon = () => (
  <svg
    className="tab-link__icon"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
  >
    <path
      d="M12 3.172 3.172 12h2.656v8h5.002v-5.002h2.34V20h5.002v-8h2.656z"
      fill="currentColor"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="tab-link__icon"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    role="img"
    aria-hidden="true"
  >
    <path
      d="m12 2 2.09 1.205 2.385-.52 1.46 2.1 2.45.61.11 2.49 1.75 1.77-1.41 2.07.43 2.45-2.28.98-.98 2.28-2.45-.43-2.07 1.41-1.77-1.75-2.49-.11-.61-2.45-2.1-1.46.52-2.385L2 12l1.205-2.09-.52-2.385 2.1-1.46.61-2.45L7.884 3.5zM12 15.6A3.6 3.6 0 1 0 12 8.4a3.6 3.6 0 0 0 0 7.2z"
      fill="currentColor"
    />
  </svg>
);

const TabNavigation = () => {
  const location = useAppLocation();

  return (
    <nav className="tab-bar" aria-label="Primary">
      <Link
        to="/"
        className={`tab-link${location.route === "home" ? " is-active" : ""}`}
        aria-current={location.route === "home" ? "page" : undefined}
      >
        <HomeIcon />
        <span>Home</span>
      </Link>
      <Link
        to="/settings"
        className={`tab-link${location.route === "settings" ? " is-active" : ""}`}
        aria-current={location.route === "settings" ? "page" : undefined}
      >
        <SettingsIcon />
        <span>Settings</span>
      </Link>
    </nav>
  );
};

export default memo(TabNavigation);
