import { describe, it, expect, vi, afterEach } from 'vitest';
import { envoyerMail, obtenirJetonGraph } from '@shared/recap/graph';

afterEach(() => vi.unstubAllGlobals());

describe('envoyerMail', () => {
  it('appelle sendMail avec le jeton et le bon corps', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await envoyerMail('jeton', 'cabinet@exemple.test', 'a@exemple.test', 'Sujet', '<p>Corps</p>');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.microsoft.com/v1.0/users/cabinet%40exemple.test/sendMail');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jeton');
    const corps = JSON.parse(init.body);
    expect(corps.message.subject).toBe('Sujet');
    expect(corps.message.body).toEqual({ contentType: 'HTML', content: '<p>Corps</p>' });
    expect(corps.message.toRecipients[0].emailAddress.address).toBe('a@exemple.test');
  });

  it('lève une erreur avec le statut HTTP sur un 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('interdit', { status: 403 })));
    await expect(envoyerMail('j', 'e@x.test', 'a@x.test', 's', 'h')).rejects.toThrow(/403.*interdit/);
  });
});

describe('obtenirJetonGraph', () => {
  it('retourne le jeton d\'accès', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: 'abc' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await obtenirJetonGraph('tenant', 'client', 'secret')).toBe('abc');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://login.microsoftonline.com/tenant/oauth2/v2.0/token');
    expect(String(init.body)).toContain('grant_type=client_credentials');
    expect(String(init.body)).toContain('scope=' + encodeURIComponent('https://graph.microsoft.com/.default'));
  });
  it('lève une erreur sur un échec', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('mauvais secret', { status: 401 })));
    await expect(obtenirJetonGraph('t', 'c', 's')).rejects.toThrow(/401/);
  });
});
