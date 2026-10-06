import { createFileRoute } from "@tanstack/react-router";
import { NovaWing } from "@/components/nova-wing";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NovaWing />;
}
