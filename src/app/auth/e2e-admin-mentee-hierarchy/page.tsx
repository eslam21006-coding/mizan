import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackLink, Breadcrumb } from "@/components/navigation-hierarchy";
import { PageHeading } from "@/components/page-heading";
import {
  MenteeAccountSummary,
  MenteeBusinessGrid,
  MenteeDirectoryCards,
} from "@/app/(app)/admin/mentees/mentee-hierarchy";
import type { MenteeRecord } from "@/lib/admin/mentee-directory";

const fixtureShellProps = {
  role: "admin" as const,
  email: "admin.fixture@example.test",
};

const MENTEE_A = "00000000-0000-4000-8000-000000000571";
const MENTEE_B = "00000000-0000-4000-8000-000000000572";
const LONG_EMAIL =
  "very.long.unbroken.mentee.account.identifier.for.mobile.layout@example.test";

const mentees: readonly MenteeRecord[] = [
  {
    userId: MENTEE_A,
    email: LONG_EMAIL,
    createdAt: "2026-09-01T00:00:00Z",
    businesses: [
      {
        id: "00000000-0000-4000-8000-000000000573",
        name: "أكاديمية ميزان",
        baseCurrency: "EGP",
        timezone: "Africa/Cairo",
      },
      {
        id: "00000000-0000-4000-8000-000000000574",
        name: "Consulting GCC",
        baseCurrency: "SAR",
        timezone: "Asia/Riyadh",
      },
    ],
  },
  {
    userId: MENTEE_B,
    email: "second.mentee@example.test",
    createdAt: null,
    businesses: [],
  },
];

type AdminMenteeHierarchyFixtureProps = {
  searchParams: Promise<{ mentee?: string }>;
};

/** Renders a CI-only Admin Mentee hierarchy using the production hierarchy components. */
export default async function AdminMenteeHierarchyFixture({
  searchParams,
}: AdminMenteeHierarchyFixtureProps) {
  if (process.env.MIZAN_E2E_UI_FIXTURE !== "true") {
    notFound();
  }

  const query = await searchParams;
  const selected = mentees.find((mentee) => mentee.userId === query.mentee) ?? null;

  return (
    <AppShell {...fixtureShellProps}>
      <section className="page-stack" aria-label="اختبار هرم المتدربين">
        {selected ? (
          <>
            <Breadcrumb
              items={[
                { label: "المتدربون", destination: { route: "admin-mentees" } },
                { label: selected.email ?? "بريد غير متاح", current: true },
              ]}
              ariaLabel="مسار إدارة المتدرب"
            />
            <BackLink
              label="العودة إلى المتدربين"
              destination={{ route: "admin-mentees" }}
            />
            <PageHeading
              title="تفاصيل المتدرب"
              description="اختر بزنسًا تابعًا لهذا المتدرب للدخول إليه من السياق الإداري."
            />
            <MenteeAccountSummary mentee={selected} />
            <MenteeBusinessGrid businesses={selected.businesses} />
          </>
        ) : (
          <>
            <PageHeading
              title="المتدربون"
              description="إدارة حسابات المتدربين والوصول إلى بزنساتهم من مستوى أب واضح."
            />
            <MenteeDirectoryCards
              mentees={mentees}
              hrefForMentee={(mentee) =>
                `/auth/e2e-admin-mentee-hierarchy?mentee=${encodeURIComponent(mentee.userId)}`
              }
            />
          </>
        )}
      </section>
    </AppShell>
  );
}
