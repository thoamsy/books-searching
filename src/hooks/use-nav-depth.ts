import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { NavigateOptions, To } from "react-router-dom";

export function useNavDepth(): number {
  const location = useLocation();
  const state = location.state as { navDepth?: number } | null;
  return state?.navDepth ?? 0;
}

export function useNavigateWithDepth() {
  const navigate = useNavigate();
  const currentDepth = useNavDepth();

  return useCallback(
    (to: To, options?: NavigateOptions) => {
      const existingState =
        (options?.state as Record<string, unknown> | null) ?? {};
      navigate(to, {
        ...options,
        state: { ...existingState, navDepth: currentDepth + 1 },
      });
    },
    [navigate, currentDepth],
  );
}
