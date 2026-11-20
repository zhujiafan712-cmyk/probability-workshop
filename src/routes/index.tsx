import { createFileRoute } from "@tanstack/react-router";
import { ProbabilityLab } from "@/components/probability-lab";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <ProbabilityLab />;
}
