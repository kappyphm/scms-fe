import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Router hash tối giản (prototype cũng điều hướng bằng hash).
// Đường dẫn dạng "#/chain/menu" -> path "/chain/menu".
// Giữ ở tầng common để mọi màn hình dùng chung một cơ chế điều hướng.

const RouterContext = createContext({ path: "/", navigate: () => {} });

function pathFromHash() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return "/";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function HashRouter({ children }) {
  const [path, setPath] = useState(() => pathFromHash());

  useEffect(() => {
    const onChange = () => setPath(pathFromHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((to) => {
    const target = to.startsWith("/") ? to : `/${to}`;
    if (pathFromHash() === target) {
      setPath(target);
    } else {
      window.location.hash = target;
    }
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  return useContext(RouterContext);
}

// Khớp path với mẫu có tham số: matchPath("/orders/:id", "/orders/12") -> { id: "12" }
export function matchPath(pattern, path) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const p = patternParts[i];
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (p !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// Chọn route đầu tiên khớp trong danh sách [{ pattern, render(params) }].
export function Routes({ routes, fallback = null }) {
  const { path } = useRouter();
  for (const route of routes) {
    const params = matchPath(route.pattern, path);
    if (params) return route.render(params);
  }
  return fallback;
}

export function RouteLink({ to, className, children, ...rest }) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
