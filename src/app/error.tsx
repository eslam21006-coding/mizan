"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone-state">
      <div className="standalone-card">
        <span className="eyebrow">حدث خطأ</span>
        <h1>تعذّر تحميل الصفحة</h1>
        <p>جرّب إعادة تحميل هذه المساحة. لن تتأثر بياناتك بهذا الإجراء.</p>
        <button type="button" className="primary-button" onClick={reset}>
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
