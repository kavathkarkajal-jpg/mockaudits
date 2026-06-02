import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/conduct")({ component: ConductLayout });

function ConductLayout() {
  return <Outlet />;
}
