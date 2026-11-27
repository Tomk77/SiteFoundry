import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "./auth";

/**
 * The one auth guard for signed-in screens: once auth has settled without a user, go to sign-in.
 * `ready` is true only when a user is present (finding 5.6).
 */
export function useRequireAuth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  return { user, loading, ready: !loading && Boolean(user) };
}
