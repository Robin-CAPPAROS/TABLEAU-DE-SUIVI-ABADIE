// Envoi d'e-mails via Microsoft Graph (client credentials). fetch natif, sans dépendance.

async function verifierReponse(r: Response, contexte: string): Promise<void> {
  if (r.ok) return;
  const corps = await r.text().catch(() => '');
  throw new Error(`${contexte} : HTTP ${r.status} ${corps}`.trim());
}

export async function obtenirJetonGraph(tenant: string, client: string, secret: string): Promise<string> {
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: client,
      client_secret: secret,
      scope: 'https://graph.microsoft.com/.default',
    }).toString(),
  });
  await verifierReponse(r, 'Jeton Graph');
  const json = (await r.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Jeton Graph : réponse sans access_token');
  return json.access_token;
}

export async function envoyerMail(
  jeton: string,
  expediteur: string,
  destinataire: string,
  sujet: string,
  html: string,
): Promise<void> {
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(expediteur)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: sujet,
        body: { contentType: 'HTML', content: html },
        toRecipients: [{ emailAddress: { address: destinataire } }],
      },
      saveToSentItems: false,
    }),
  });
  await verifierReponse(r, 'Envoi du message');
}
