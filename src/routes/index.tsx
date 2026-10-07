import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/auth";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return <Navigate to="/login" />;
}
