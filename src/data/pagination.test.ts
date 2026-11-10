import { lireTout } from './pagination';

const lignes = (n: number) => Array.from({ length: n }, (_, i) => ({ i }));

test('enchaine les pages jusqu a une page incomplete', async () => {
  const tailles = [1000, 1000, 10];
  const appels: [number, number][] = [];
  const res = await lireTout<{ i: number }>(async (de, a) => {
    appels.push([de, a]);
    return { data: lignes(tailles.shift() ?? 0), error: null };
  });
  expect(res).toHaveLength(2010);
  expect(appels).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
});

test('une erreur est propagee', async () => {
  await expect(lireTout(async () => ({ data: null, error: { message: 'boum' } }))).rejects.toEqual({ message: 'boum' });
});
