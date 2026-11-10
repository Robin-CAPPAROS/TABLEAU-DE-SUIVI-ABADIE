import { useState } from 'react';
import { dateDuJourParis } from '@domain/dates';
import type { LigneEcheance } from '@/data/types';
import { descripteurEcheance } from '@/components/StatutBadge';
import { LIBELLES_TYPE } from '@/lib/libelles';
import { cn } from '@/lib/utils';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const COULEURS: Record<string, string> = {
  neutre: 'bg-gris/30 text-marine',
  info: 'bg-primaire text-white',
  succes: 'bg-green-600 text-white',
  alerte: 'bg-red-600 text-white',
  orange: 'bg-orange-500 text-white',
  violet: 'bg-purple-600 text-white',
};

const iso = (a: number, m: number, j: number) =>
  `${a}-${String(m + 1).padStart(2, '0')}-${String(j).padStart(2, '0')}`;

export default function CalendrierMensuel({ lignes }: { lignes: LigneEcheance[] }) {
  const aujourdhui = dateDuJourParis(new Date());
  const [mois, setMois] = useState(() => ({ a: Number(aujourdhui.slice(0, 4)), m: Number(aujourdhui.slice(5, 7)) - 1 }));

  const decaler = (delta: number) =>
    setMois(({ a, m }) => {
      const d = new Date(Date.UTC(a, m + delta, 1));
      return { a: d.getUTCFullYear(), m: d.getUTCMonth() };
    });

  const premier = new Date(Date.UTC(mois.a, mois.m, 1));
  const decalage = (premier.getUTCDay() + 6) % 7;
  const nbJours = new Date(Date.UTC(mois.a, mois.m + 1, 0)).getUTCDate();
  const cases: (string | null)[] = [
    ...Array<null>(decalage).fill(null),
    ...Array.from({ length: nbJours }, (_, i) => iso(mois.a, mois.m, i + 1)),
  ];
  while (cases.length % 7 !== 0) cases.push(null);

  const titre = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(premier);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => decaler(-1)} className="rounded border border-gris px-3 py-1 text-sm">
          Mois précédent
        </button>
        <h3 className="text-base font-bold capitalize text-marine">{titre}</h3>
        <button type="button" onClick={() => decaler(1)} className="rounded border border-gris px-3 py-1 text-sm">
          Mois suivant
        </button>
      </div>
      <div className="overflow-x-auto">
        <div role="grid" aria-label={titre} className="grid min-w-[42rem] grid-cols-7 gap-px bg-gris/40">
          {JOURS.map((j) => (
            <div key={j} role="columnheader" className="bg-marine p-1 text-center text-xs font-bold text-white">{j}</div>
          ))}
          {cases.map((jour, i) => (
            <div key={i} role="gridcell" className={cn('min-h-20 bg-white p-1', jour === aujourdhui && 'ring-2 ring-inset ring-primaire')}>
              {jour && (
                <>
                  <div className="text-xs font-bold text-marine">{Number(jour.slice(8))}</div>
                  <ul className="mt-1 space-y-1">
                    {lignes.filter((l) => l.date_limite === jour).map((l) => (
                      <li
                        key={l.id}
                        title={`${l.raison_sociale} : ${LIBELLES_TYPE[l.type]}`}
                        className={cn('truncate rounded px-1 text-[11px]', COULEURS[descripteurEcheance(l).tonalite])}
                      >
                        {l.raison_sociale} : {LIBELLES_TYPE[l.type]}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
