import { Link } from "react-router-dom";
import { useNavDepth } from "@/hooks/use-nav-depth";
import type { ComponentProps } from "react";

type DepthLinkProps = ComponentProps<typeof Link>;

export function DepthLink({ state, ...props }: DepthLinkProps) {
  const currentDepth = useNavDepth();
  const existingState = (state as Record<string, unknown> | null) ?? {};

  return (
    <Link
      {...props}
      state={{ ...existingState, navDepth: currentDepth + 1 }}
    />
  );
}
