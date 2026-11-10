import type { DossierRegles, ExerciceRegles, ISODate, ParametresFiscaux, ResultatGeneration } from './types.ts';
import { genererTva } from './tva.ts';
import { genererEcheancesExercice, trierEcheances } from './exercice.ts';

export function genererEcheancesDossier(
  d: DossierRegles,
  exercices: ExerciceRegles[],
  p: ParametresFiscaux,
  aujourdhui: ISODate,
  horizonMois = 15,
): ResultatGeneration {
  if (d.statut === 'sorti') return { echeances: [], anomalies: [] };

  const resultats = [
    genererTva(d, exercices, p, aujourdhui, horizonMois),
    ...exercices.map((e) => genererEcheancesExercice(d, e, p, aujourdhui, horizonMois)),
  ];
  const vues = new Set<string>();
  const anomalies = resultats.flatMap((r) => r.anomalies).filter((a) => {
    const cle = `${a.type}\u0000${a.cle}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
  return { echeances: trierEcheances(resultats.flatMap((r) => r.echeances)), anomalies };
}
