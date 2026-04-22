import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>Official Declaration // Effective Immediately</div>

      <h1 className={styles.heading}>
        TEAM MOGWICK
        <br />
        IS COMING
        <br />
        FOR GOLD!
      </h1>

      <p className={styles.tagline}>
        After a grueling training regimen (one espresso) and rigorous preparation
        (writing this sentence), <em>Team Mogwick</em> has officially entered the ring.
        Rival teams are cordially invited to consider participating for&nbsp;<em>silver</em>.
      </p>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNum}>420%</div>
          <div className={styles.statLabel}>Confidence</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>0</div>
          <div className={styles.statLabel}>Backup Plans</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>&infin;</div>
          <div className={styles.statLabel}>Swagger</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNum}>1</div>
          <div className={styles.statLabel}>HTML Files Shipped</div>
        </div>
      </div>

      <div className={styles.marquee}>
        <span className={styles.marqueeTrack}>
          GOLD OR NOTHING &nbsp;&bull;&nbsp; NO SECOND PLACE &nbsp;&bull;&nbsp; MOGWICK SUPREMACY &nbsp;&bull;&nbsp;
          WE BROUGHT SNACKS &nbsp;&bull;&nbsp; OTHER TEAMS PLEASE STEP ASIDE &nbsp;&bull;&nbsp;
          GOLD OR NOTHING &nbsp;&bull;&nbsp; NO SECOND PLACE &nbsp;&bull;&nbsp; MOGWICK SUPREMACY &nbsp;&bull;&nbsp;
          WE BROUGHT SNACKS &nbsp;&bull;&nbsp; OTHER TEAMS PLEASE STEP ASIDE &nbsp;&bull;&nbsp;
        </span>
      </div>

      <p className={styles.roster}>
        Undefeated since <span>approximately 14 seconds ago</span>.
        <br />
        Current medal count: <span>pending</span>. Projected medal count: <span>all of them</span>.
      </p>

      <footer className={styles.footer}>
        This page is legally binding in no known jurisdictions. Gold medals depicted are
        conceptual. Team Mogwick accepts no liability for silver-related emotional damage
        sustained by rival teams. All performance statistics were derived entirely from vibes.
      </footer>
    </div>
  );
}
