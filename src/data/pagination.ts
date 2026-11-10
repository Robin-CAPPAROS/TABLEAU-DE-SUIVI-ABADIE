type Page<T> = { data: T[] | null; error: { message: string } | null };

/** Lit toutes les lignes en pages successives (PostgREST plafonne une réponse à 1000 lignes). */
export async function lireTout<T>(
  construire: (de: number, a: number) => PromiseLike<Page<T>>,
  taillePage = 1000,
): Promise<T[]> {
  const tout: T[] = [];
  for (let de = 0; ; de += taillePage) {
    const { data, error } = await construire(de, de + taillePage - 1);
    if (error) throw error;
    const page = data ?? [];
    tout.push(...page);
    if (page.length < taillePage) return tout;
  }
}
