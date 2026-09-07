import styles from "./transaction-import.module.css";

/** Explains review-versus-save behavior and how invalid rows are skipped without blocking valid transactions. */
export function TransactionImportReviewGuide() {
  return (
    <section className={styles.importGuide} aria-labelledby="transaction-review-next-step-title">
      <div className={styles.guideHeading}>
        <div>
          <span className={styles.kicker}>ماذا أفعل بعد المراجعة؟</span>
          <h2 id="transaction-review-next-step-title">المراجعة وحدها لا تحفظ أي معاملات</h2>
        </div>
        <div className={styles.headingLinks}>
          <a className={styles.guideDownload} href="#transaction-file">
            اختيار ملف مصحح
          </a>
          <a className={styles.backLink} href="#transaction-validation-title">
            العودة للمراجعة والحفظ
          </a>
        </div>
      </div>

      <p className={styles.guideNote}>
        أرقام «جاهزة للاستيراد» و«صفوف سيتم تجاهلها» هي نتيجة فحص فقط. لا يكتب ميزان أي معاملة في قاعدة
        البيانات بمجرد الضغط على «مراجعة الملف».
      </p>

      <p className={styles.splitNote}>
        وجود صفوف غير صالحة لا يوقف باقي الملف. سيعرض ميزان عدد الصفوف المتجاهلة وأسبابها، ثم يستورد
        الصفوف السليمة فقط. الصف المتجاهل لا يُحفظ ولا يدخل في حسابات العملاء، وميزان لا يخمن مبلغًا
        مفقودًا ولا يحول عملة مختلفة إلى العملة الأساسية تلقائيًا.
      </p>

      <p className={styles.guideNote}>
        يمكنك تصحيح الصفوف المتجاهلة وإعادة رفعها لاحقًا إذا أردت إدخالها. بعد المراجعة أكمل مصدر
        المعاملات ونوع الملف وتأكيداته، ثم اضغط زر الاستيراد. هذا هو الإجراء الذي يحفظ المعاملات فعلًا،
        وبعد نجاحه سيظهر لك تأكيد الحفظ وزر «عرض تحليل العملاء».
      </p>
    </section>
  );
}
