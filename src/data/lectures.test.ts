import { beforeEach, vi } from 'vitest';
import { listerEcheances, listerEcheancesAAttention } from './echeances';
import { listerExercices } from './exercices';
import { listerEcheancesDossier } from './dossiers';

type Appel = { table: string; methodes: [string, unknown[]][] };
const appels: Appel[] = [];

vi.mock('@/lib/supabase', () => {
  const requete = (appel: Appel): unknown =>
    new Proxy({}, {
      get: (_cible, nom: string) => (...args: unknown[]) => {
        appel.methodes.push([nom, args]);
        return nom === 'range' ? Promise.resolve({ data: [], error: null }) : requete(appel);
      },
    });
  return {
    supabase: {
      from: (table: string) => {
        const appel: Appel = { table, methodes: [] };
        appels.push(appel);
        return requete(appel);
      },
    },
  };
});

const exclutSortis = (a: Appel) => a.methodes.some(([nom, args]) => nom === 'neq' && args[0] === 'dossier_statut' && args[1] === 'sorti');

beforeEach(() => {
  appels.length = 0;
});

test('les listes de l échéancier et de la production excluent les dossiers sortis', async () => {
  await listerEcheances({ mesDossiers: false }, 'c1');
  await listerEcheancesAAttention();
  await listerExercices({ mesDossiers: false }, 'c1');
  expect(appels.map((a) => a.table)).toEqual(['v_echeances', 'v_echeances', 'v_exercices']);
  expect(appels.every(exclutSortis)).toBe(true);
});

test('la fiche dossier conserve toutes les échéances', async () => {
  await listerEcheancesDossier('d1');
  expect(appels).toHaveLength(1);
  expect(exclutSortis(appels[0])).toBe(false);
});
