export default function Loading() {
  return (
    <div className="page-stack" role="status" aria-label="جارٍ التحميل">
      <div className="loading-line loading-line-short" />
      <div className="loading-line loading-line-title" />
      <div className="loading-line loading-line-copy" />
      <div className="loading-panel" />
    </div>
  );
}
