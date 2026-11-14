import { ProfileForm } from "@/components/ProfileForm";
import { requireStudent } from "@/lib/session";
import { availableSyllabi } from "@/syllabus";
import { aiStatus } from "@/lib/ai";

export default async function SettingsPage() {
  const { profile, email } = await requireStudent();
  const ai = aiStatus();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Signed in as {email}</p>
      </div>
      <ProfileForm
        submitLabel="Save"
        available={availableSyllabi()}
        initial={{
          level: profile.level,
          group: profile.group,
          attemptMonth: profile.attemptMonth,
          attemptYear: profile.attemptYear,
          examDate: profile.examDate ?? "",
          dailyTargetHours: profile.dailyTargetMinutes / 60,
        }}
      />
      <div className="card text-sm">
        <h2 className="mb-2 font-medium">AI test generator</h2>
        <p>Primary: <b>{ai.primary ?? "not configured"}</b> · Fallback: <b>{ai.fallback ?? "not configured"}</b></p>
        {!ai.primary && !ai.fallback && (
          <p className="mt-2 text-red-600">No AI provider is configured, so tests can&apos;t be generated. See the README for setup.</p>
        )}
      </div>
    </div>
  );
}
