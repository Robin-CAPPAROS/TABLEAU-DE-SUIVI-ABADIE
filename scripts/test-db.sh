#!/usr/bin/env bash
# Banc de test SQL : cluster PostgreSQL 16 temporaire, migrations, puis chaque supabase/tests/*.test.sql.
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT=54329

if [ "$(id -u)" -eq 0 ]; then
  COMME_PG=(runuser -u postgres --)
else
  COMME_PG=()
fi

TMP="$(mktemp -d)"
chmod 755 "$TMP"
if [ "$(id -u)" -eq 0 ]; then chown postgres "$TMP"; fi
DATA="$TMP/data"
SOCK="$TMP/sock"
"${COMME_PG[@]}" mkdir -p "$SOCK"

nettoyer() {
  "${COMME_PG[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap nettoyer EXIT

"${COMME_PG[@]}" "$PGBIN/initdb" -D "$DATA" -A trust -U postgres --no-sync >/dev/null
"${COMME_PG[@]}" "$PGBIN/pg_ctl" -D "$DATA" -w -l "$TMP/pg.log" \
  -o "-p $PORT -k $SOCK -c listen_addresses='' -c fsync=off" start >/dev/null

psql_base() {
  # Le SQL est lu sur stdin : aucun fichier du depot n'a besoin d'etre lisible par postgres.
  "${COMME_PG[@]}" "$PGBIN/psql" -q -X -h "$SOCK" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 "$@"
}
export PGOPTIONS='-c client_min_messages=warning'

psql_base -d postgres -c 'create database app_test' >/dev/null
psql_base -d app_test < "$RACINE/supabase/tests/bootstrap.sql"

for f in "$RACINE"/supabase/migrations/*.sql; do
  psql_base -d app_test < "$f" || { echo "ECHEC migration $(basename "$f")" >&2; exit 1; }
done

statut=0
for t in "$RACINE"/supabase/tests/*.test.sql; do
  nom="$(basename "$t")"
  # fixtures dans la transaction du test : on les injecte apres le begin.
  if awk 'BEGIN{d=0} /^begin;/ && !d {print; system("cat \"'"$RACINE"'/supabase/tests/fixtures.sql\""); d=1; next} {print}' "$t" \
      | psql_base -d app_test; then
    echo "OK $nom"
  else
    echo "ECHEC $nom" >&2
    statut=1
    break
  fi
done
exit $statut
