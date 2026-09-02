import { useNavigate, useRouterState } from "@tanstack/react-router";

/**
 * Compat shim untuk menggantikan useNavigate dari react-router-dom.
 * Menerima path string biasa termasuk query string, mis. navigate('/key-system?key=abc')
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return (path: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return navigate({ href: path } as any);
  };
}

/**
 * Compat shim untuk useSearchParams dari react-router-dom.
 */
export function useCompatSearchParams(): [
  URLSearchParams,
  (params: URLSearchParams) => void,
] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = new URLSearchParams(searchStr);
  const setParams = (p: URLSearchParams) => {
    const qs = p.toString();
    window.history.replaceState(null, "", pathname + (qs ? `?${qs}` : ""));
  };
  return [params, setParams];
}
