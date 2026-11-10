/** Message affichable d'une erreur (Error ou erreur PostgREST, qui n'hérite pas d'Error). */
export function messageErreur(e: unknown, defaut = "L'opération a échoué."): string {
  if (e instanceof Error) return e.message;
  const m = (e as { message?: unknown } | null)?.message;
  return typeof m === 'string' && m ? m : defaut;
}
