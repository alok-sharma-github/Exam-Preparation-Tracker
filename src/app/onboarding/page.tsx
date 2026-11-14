import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/session";
import { availableSyllabi } from "@/syllabus";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.profile) redirect("/dashboard");
  const now = new Date();
  // Default to the next January attempt.
  const nextJanYear = now.getMonth() === 0 ? now.getFullYear() : now.getFullYear() + 1;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Welcome, {user.name}</h1>
      <p className="mb-6 text-sm text-muted">Tell us what you&apos;re preparing for. You can change this later in Settings.</p>
      <ProfileForm
        submitLabel="Start tracking"
        available={availableSyllabi()}
        initial={{ level: "intermediate", group: "group2", attemptMonth: 1, attemptYear: nextJanYear, examDate: "", dailyTargetHours: 8 }}
      />
    </div>
  );
}
