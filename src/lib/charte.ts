/** Couleurs de la charte graphique, source unique (Tailwind et graphiques). */
export const CHARTE = { marine: '#0E2A42', primaire: '#2784C6', gris: '#B2B2B1' } as const;

/** `n` teintes dérivées de `hex`, de la couleur pleine vers une version éclaircie. */
export function teintes(hex: string, n: number): string[] {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0 : (k / (n - 1)) * 0.6;
    return '#' + c.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('');
  });
}
