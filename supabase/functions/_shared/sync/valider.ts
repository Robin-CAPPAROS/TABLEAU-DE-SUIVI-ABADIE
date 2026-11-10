import { z } from 'zod';

const MAX_DOSSIERS = 50;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ');
const texteOuNul = z.string().nullable().optional();
const idPennylane = z.number().int().positive();

// Aucun .default() dans les objets : une clé absente doit rester absente
// (le SQL distingue absent = conserver, null explicite = effacer).
const schemaDossier = z.object({
  pennylane_id: idPennylane,
  siren: texteOuNul,
  raison_sociale: z.string().optional(),
  forme_juridique: texteOuNul,
  regime_tva: texteOuNul,
  categorie_fiscale: texteOuNul,
  regime_fiscal: texteOuNul,
  comptable: texteOuNul,
  superviseur: texteOuNul,
  manager: texteOuNul,
  exercices: z.array(z.object({ debut: date, fin: date })).optional(),
});

const schemaDeclarationTva = z.object({
  pennylane_id: idPennylane,
  periode_debut: date,
  periode_fin: date,
  date_limite: date.nullable().optional(),
  date_depot: date.nullable().optional(),
  statut: z.string(),
  montant: z.union([z.string(), z.number()]).nullable().optional(),
});

const schemaLiasse = z.object({
  pennylane_id: idPennylane,
  periode_debut: date,
  periode_fin: date,
  categorie_fiscale: texteOuNul,
  date_limite: date.nullable().optional(),
  date_depot: date.nullable().optional(),
  statut: z.string(),
});

export const schemaPayload = z.object({
  source: z.enum(['mcp', 'api']),
  dossiers: z.array(schemaDossier).default([]),
  declarations_tva: z.array(schemaDeclarationTva).default([]),
  liasses: z.array(schemaLiasse).default([]),
});

export type PayloadSync = z.infer<typeof schemaPayload>;

export function validerPayload(
  corps: unknown,
): { ok: true; payload: PayloadSync } | { ok: false; erreur: string } {
  const resultat = schemaPayload.safeParse(corps);
  if (!resultat.success) {
    const anomalie = resultat.error.issues[0];
    const chemin = anomalie.path.length > 0 ? anomalie.path.join('.') : 'corps';
    return { ok: false, erreur: `Payload invalide (${chemin}) : ${anomalie.message}` };
  }
  if (resultat.data.dossiers.length > MAX_DOSSIERS) {
    return { ok: false, erreur: `Lot limité à ${MAX_DOSSIERS} dossiers.` };
  }
  return { ok: true, payload: resultat.data };
}
