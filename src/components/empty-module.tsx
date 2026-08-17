type EmptyModuleProps = {
  title: string;
  description: string;
};

export function EmptyModule({ title, description }: EmptyModuleProps) {
  return (
    <section className="empty-module" aria-label={title}>
      <div className="empty-module-icon" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
