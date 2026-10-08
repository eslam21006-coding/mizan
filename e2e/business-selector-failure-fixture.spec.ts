import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.MIZAN_E2E_UI_FIXTURE === "true";

test.describe("CI-only shell business load failure fixture", () => {
  test.skip(!fixtureEnabled, "Requires MIZAN_E2E_UI_FIXTURE=true");

  test("shows a load error instead of an empty-business state and uses safe navigation", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/auth/e2e-app-shell?businessesError=1");

    const sidebar = page.locator(".desktop-sidebar");
    const navigation = sidebar.getByRole("navigation", { name: "التنقل الرئيسي" });

    await expect(sidebar.getByText("تعذر تحميل البزنسات", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("لا يوجد بزنس بعد", { exact: true })).toHaveCount(0);
    await expect(sidebar.getByRole("combobox", { name: "البزنس الحالي" })).toHaveCount(0);

    await expect(navigation.getByRole("link", { name: "الرئيسية" })).toHaveAttribute("href", "/");
    await expect(navigation.getByRole("link", { name: "الأرقام" })).toHaveAttribute("href", "/monthly");
    await expect(navigation.getByRole("link", { name: "العملاء" })).toHaveAttribute("href", "/customers");
    await expect(navigation.getByRole("link", { name: "المبيعات" })).toHaveAttribute("href", "/funnels");
    await expect(navigation.getByRole("link", { name: "التخطيط" })).toHaveAttribute(
      "href",
      "/target-plan",
    );
    await expect(sidebar.getByRole("link", { name: "إدارة البزنسات" })).toHaveAttribute(
      "href",
      "/businesses",
    );

    expect(errors).toEqual([]);
  });
});
