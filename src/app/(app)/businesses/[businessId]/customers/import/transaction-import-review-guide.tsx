import styles from "./transaction-import.module.css";

/** Explains the all-or-nothing validation gate and the explicit action that persists transactions. */
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
        أرقام «صفوف صالحة» و«صفوف غير صالحة» هي نتيجة فحص فقط. لا يكتب ميزان أي معاملة في قاعدة
        البيانات بمجرد الضغط على «مراجعة الملف».
      </p>

      <p className={styles.splitNote}>
        إذا كان عدد الصفوف غير الصالحة أكبر من صفر، يتوقف الحفظ بالكامل. صحح الصفوف الموضحة في جدول
        المشكلات ثم ارفع الملف المصحح من جديد. ميزان لا يستورد الصفوف الصالحة وحدها ولا يتجاهل الأخطاء
        تلقائيًا.
      </p>

      <p className={styles.guideNote}>
        إذا أصبحت المراجعة ناجحة، أكمل مصدر المعاملات ونوع الملف وتأكيداته، ثم اضغط «استيراد
        المعاملات». هذا هو الإجراء الذي يحفظ المعاملات فعلًا، وبعد نجاحه سيظهر لك تأكيد الحفظ وزر «عرض
        تحليل العملاء».
      </p>
    </section>
  );
}
