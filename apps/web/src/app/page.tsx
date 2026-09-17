const stages = ['רעיון', 'אימות', 'בנייה', 'השקה', 'הכנסות', 'צמיחה'];

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand">🐼 PANDA PRODUCT OS</div>
        <p className="eyebrow">COMMAND CENTER · M0 FOUNDATION</p>
        <h1>מרעיון למוצר רווחי — עם מערכת שלא נותנת לנו לדלג על מה שחשוב.</h1>
        <p className="lead">Evidence · Stage Gates · Automation · Panda Chief AI</p>
        <div className="flow">
          {stages.map((stage, index) => <span key={stage}>{index + 1}. {stage}</span>)}
        </div>
      </section>
      <section className="grid">
        <article className="card"><small>Milestone</small><strong>M0</strong><p>Engineering Foundation</p></article>
        <article className="card"><small>Architecture</small><strong>RTL First</strong><p>Hebrew-first product shell</p></article>
        <article className="card"><small>Quality Rule</small><strong>Verified</strong><p>לא מסמנים Built לפני בדיקה</p></article>
      </section>
    </main>
  );
}
