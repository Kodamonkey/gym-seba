import { useLiveQuery } from 'dexie-react-hooks';
import { monthName, parseLocalDate } from '../../domain/dates';
import type { WorkoutSession } from '../../domain/types';
import { db } from '../../data/db';
import { Loading, PageHeader } from '../../ui/primitives';
import { SessionRow } from '../shared';

/** Entrenamientos guardados, del más reciente al más antiguo, agrupados por mes. */
export function HistoryPage() {
  const sessions = useLiveQuery(
    async () => (await db.sessions.where('status').anyOf('completed', 'partial').toArray()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
    [],
  );
  if (!sessions) return <Loading />;

  const groups: { key: string; label: string; items: WorkoutSession[] }[] = [];
  for (const s of sessions) {
    const { y, m } = parseLocalDate(s.localDate);
    const key = `${y}-${m}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: `${monthName(m)} ${y}`, items: [] };
      groups.push(g);
    }
    g.items.push(s);
  }

  return (
    <div>
      <PageHeader back="/" title="Historial" subtitle={`${sessions.length} entrenamiento${sessions.length === 1 ? '' : 's'}`} />
      {sessions.length === 0 && <p className="py-10 text-muted">Aquí aparecerán tus entrenamientos guardados.</p>}
      {groups.map((g) => (
        <section key={g.key} className="mt-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{g.label}</h2>
          <ul className="divide-y divide-line">
            {g.items.map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
