#!/usr/bin/env bash
# Pruebas de humo de solo lectura del sitio tras desplegar a staging. Las ejecuta la plantilla de despliegue
# (KikeGonRam/urbanblade-ci) con HEALTH_URL en el entorno. La salud solo prueba que Nuxt responde; esto prueba que el sitio
# renderiza las páginas públicas con datos reales de la API (el contrato entre frontend y barber). No inicia sesión ni escribe
# nada. Si falla, el despliegue se revierte solo a la imagen anterior.
# shellcheck disable=SC2015  # `A && B || error` es intencional: el error aplica si A o B fallan
set -u

: "${HEALTH_URL:?HEALTH_URL es obligatoria}"
API_URL="${API_URL:-https://api.urbanblade.com.mx}"

fallo=0

# Primer servicio del catálogo real de la API: debe aparecer en la página de servicios.
codigo=$(curl -s -m 20 --retry 5 --retry-delay 6 --retry-all-errors -H 'Accept: application/json' \
  -o /tmp/servicios.json -w '%{http_code}' "$API_URL/api/v1/services")
nombre=$(jq -r '.data[0].nombre // empty' /tmp/servicios.json 2> /dev/null || true)
[ "$codigo" = 200 ] && [ -n "$nombre" ] || { echo "::error::La API no devolvió servicios (código $codigo)."; fallo=1; }

for ruta in / /servicios /equipo; do
  codigo=$(curl -s -m 30 --retry 5 --retry-delay 6 --retry-all-errors -o /tmp/pagina.html -w '%{http_code}' "$HEALTH_URL$ruta")
  tam=$(wc -c < /tmp/pagina.html)
  echo "GET $ruta -> $codigo, ${tam} bytes"
  { [ "$codigo" = 200 ] && [ "$tam" -gt 3000 ]; } || { echo "::error::$ruta respondió $codigo con $tam bytes."; fallo=1; }
  # El nombre solo se busca si no trae caracteres que el HTML escapa.
  if [ "$ruta" = /servicios ] && [ -n "$nombre" ] && ! printf '%s' "$nombre" | grep -q "[&<>\"']"; then
    grep -qF -- "$nombre" /tmp/pagina.html || { echo "::error::/servicios no muestra el servicio '$nombre' de la API."; fallo=1; }
  fi
done

# Una ruta inexistente debe dar 404 real, no 200 ni 500.
codigo=$(curl -s -m 20 --retry 3 --retry-delay 6 --retry-all-errors -o /dev/null -w '%{http_code}' "$HEALTH_URL/ruta-que-no-existe-humo")
echo "GET /ruta-que-no-existe-humo -> $codigo"
[ "$codigo" = 404 ] || { echo "::error::Una ruta inexistente respondió $codigo y se esperaba 404."; fallo=1; }

exit "$fallo"
