import { Brand } from "./brand";
import styles from "./auth-card.module.css";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brandRow}>
          <Brand />
        </div>
        <div className={styles.heading}>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
