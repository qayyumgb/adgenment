import { notFound } from "next/navigation";
import { DevTeam } from "./DevTeam";

export const metadata = { title: "Team (dev)", robots: { index: false } };

/** Dev-only: the Team panel inside the shell; the screenshot script answers its API calls. */
export default function DevTeamPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevTeam />;
}
