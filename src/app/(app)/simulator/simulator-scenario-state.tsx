import type { SimulatorScenarioState } from "@/lib/simulator-scenario-state";
import styles from "./simulator.module.css";

type SimulatorScenarioStateProps = {
  state: SimulatorScenarioState;
};

/** Makes the current saved/new/unavailable Simulator scenario state explicit to the user. */
export function SimulatorScenarioStateBanner({ state }: SimulatorScenarioStateProps) {
  if (state.kind === "unavailable") {
    return (
      <section className={styles.scenarioStateError} role="alert" data-scenario-state="unavailable">
        <span>حالة السيناريو</span>
        <strong>السيناريو المحدد غير متاح</strong>
        <p>
          الرابط يشير إلى سيناريو غير موجود أو لا ينتمي للبزنس الحالي. لم يفتحه ميزان كسيناريو
          جديد تلقائيًا.
        </p>
      </section>
    );
  }

  if (state.kind === "saved") {
    return (
      <section className={styles.scenarioStatePanel} data-scenario-state="saved">
        <span>سيناريو محفوظ</span>
        <strong>{state.scenario.name}</strong>
        <p>سيظل هذا السيناريو محددًا عند تغيير الشهر المرجعي داخل نفس البزنس.</p>
      </section>
    );
  }

  return (
    <section className={styles.scenarioStatePanel} data-scenario-state="new">
      <span>سيناريو جديد</span>
      <strong>غير محفوظ</strong>
      <p>التعديلات الحالية مؤقتة حتى تحفظ السيناريو. التنقل بعيدًا عنها قد يفقدها.</p>
    </section>
  );
}

/** Persists only a validated saved scenario through same-business Simulator GET navigation. */
export function SimulatorScenarioStateFields({ state }: SimulatorScenarioStateProps) {
  if (state.kind !== "saved") return null;
  return <input type="hidden" name="scenario" value={state.scenario.id} />;
}
