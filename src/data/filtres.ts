/** Filtre PostgREST `.or(...)` : le collaborateur est CSP, Senior ou manager du dossier. */
export const intervenant = (id: string) => `csp_id.eq.${id},senior_id.eq.${id},manager_id.eq.${id}`;
