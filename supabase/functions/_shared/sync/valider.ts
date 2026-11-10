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
  raison_sociale: texteOuNul,
  forme_juridique: texteOuNul,
  regime_tva: texteOuNul,
  categorie_fiscale: texteOuNul,
  regime_fiscal: texteOuNul,
  comptable: texteOuNul,
  superviseur: texteOuNul,
  manager: texteOuNul,
  exercices: z.array(z.object({ debut: date, fin: date })).nullable().optional(),
});

const schemaDeclarationTva = z.object({
  pennylane_id: idPennylane,
  periode_debut: date,
  periode_fin: date,
  date_limite: date.nullable().optional(),
  date_depot: date.nullable().optional(),
  statut: texteOuNul,
  montant: z.union([z.string(), z.number()]).nullable().optional(),
});

const schemaLiasse = z.object({
  pennylane_id: idPennylane,
  periode_debut: date,
  periode_fin: date,
  categorie_fiscale: texteOuNul,
  date_limite: date.nullable().optional(),
  date_depot: date.nullable().optional(),
  statut: texteOuNul,
});

// Enveloppe : validée strictement ; une enveloppe invalide refuse tout le lot.
// Chaque élément est ensuite validé seul : un élément invalide est écarté et signalé (R32).
const schemaEnveloppe = z.object({
  source: z.enum(['mcp', 'api']),
  dossiers: z.array(z.unknown()).default([]),
  declarations_tva: z.array(z.unknown()).default([]),
  liasses: z.array(z.unknown()).default([]),
});

export type DossierSync = z.infer<typeof schemaDossier>;
export type DeclarationTvaSync = z.infer<typeof schemaDeclarationTva>;
export type LiasseSync = z.infer<typeof schemaLiasse>;

export type PayloadSync = {
  source: 'mcp' | 'api';
  dossiers: DossierSync[];
  declarations_tva: DeclarationTvaSync[];
  liasses: LiasseSync[];
};

export type ListeSync = 'dossiers' | 'declarations_tva' | 'liasses';

export type Rejet = { liste: ListeSync; index: number; pennylane_id: number | null; erreur: string };

function message(e: z.ZodError, racine: string): string {
  const anomalie = e.issues[0];
  const chemin = anomalie.path.length > 0 ? anomalie.path.join('.') : racine;
  return `${chemin} : ${anomalie.message}`;
}

function idLisible(element: unknown): number | null {
  const id = (element as { pennylane_id?: unknown } | null)?.pennylane_id;
  return idPennylane.safeParse(id).success ? (id as number) : null;
}

function trier<T>(liste: ListeSync, elements: unknown[], schema: z.ZodType<T>, rejets: Rejet[]): T[] {
  const valides: T[] = [];
  elements.forEach((element, index) => {
    const r = schema.safeParse(element);
    if (r.success) valides.push(r.data);
    else rejets.push({ liste, index, pennylane_id: idLisible(element), erreur: message(r.error, 'élément') });
  });
  return valides;
}

export function validerPayload(
  corps: unknown,
): { ok: true; payload: PayloadSync; rejets: Rejet[] } | { ok: false; erreur: string } {
  const enveloppe = schemaEnveloppe.safeParse(corps);
  if (!enveloppe.success) {
    return { ok: false, erreur: `Payload invalide (${message(enveloppe.error, 'corps')})` };
  }
  const e = enveloppe.data;
  if (e.dossiers.length > MAX_DOSSIERS) {
    return { ok: false, erreur: `Lot limité à ${MAX_DOSSIERS} dossiers.` };
  }
  const rejets: Rejet[] = [];
  const payload: PayloadSync = {
    source: e.source,
    dossiers: trier('dossiers', e.dossiers, schemaDossier, rejets),
    declarations_tva: trier('declarations_tva', e.declarations_tva, schemaDeclarationTva, rejets),
    liasses: trier('liasses', e.liasses, schemaLiasse, rejets),
  };
  return { ok: true, payload, rejets };
}
