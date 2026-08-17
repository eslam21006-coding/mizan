import Link from "next/link";

export default function NotFound() {
  return (
    <main className="standalone-state">
      <div className="standalone-card">
        <span className="eyebrow">404</span>
        <h1>الصفحة غير موجودة</h1>
        <p>الرابط الذي فتحته غير متاح داخل ميزان.</p>
        <Link href="/" className="primary-link">
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
