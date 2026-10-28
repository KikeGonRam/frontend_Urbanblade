# Despliegue del frontend

Guía de publicación de `frontend-urban` (Nuxt, SSR) en el entorno de pruebas de AWS.
Estado verificado en solo lectura el 28 de octubre de 2026. Si lo que ves en la consola de
AWS no coincide con esta fecha, confía en la consola. La infraestructura compartida
(red, balanceador, CloudFront, DNS, secretos, acceso de compañeros) se documenta una sola
vez en la guía del backend:
[DESPLIEGUE_AWS_STAGING.md](https://github.com/KikeGonRam/barber/blob/main/docs/DESPLIEGUE_AWS_STAGING.md).
Esta página solo cubre lo propio del frontend.

No contiene credenciales. Un cambio documental también puede disparar integraciones
externas (por ejemplo una conexión automática con Vercel): no asumir que Markdown
queda excluido.

## Qué corre hoy

| Elemento | Valor |
| --- | --- |
| Servicio ECS | `uba-stg-frontend`, cluster `urbanblade-staging`, región `us-east-1` |
| Estrategia | FARGATE normal, 2 tareas (desde el 24-oct-2026; antes Spot) |
| Task definition | `urbanblade-staging-frontend:6`, 512 CPU / 1 GB, puerto 3000 |
| Imagen | repositorio ECR `urbanblade/frontend-urban`, etiqueta `latest` |
| Salud | `GET /api/health` (también es el `HEALTHCHECK` de la imagen) |
| Dominio | `urbanblade.com.mx` y `www`, vía CloudFront `E1LFM8ET3R2TF3` |
| Variables | `NUXT_PUBLIC_API_BASE=https://api.urbanblade.com.mx/api/v1`, `NUXT_PUBLIC_STRIPE_KEY` (clave pública), `TRUSTED_PROXY_HOPS=2`, `ABUSE_BLOCK_ENABLED=true` |
| Secretos | ninguno en la task definition |

`NUXT_PUBLIC_API_BASE` y `NUXT_PUBLIC_STRIPE_KEY` se leen al arrancar, no al construir:
cambiarlas exige una task definition nueva, no una imagen nueva. `NUXT_UPLOADS_HOSTS`
acota la política de imágenes (CSP) cuando se usan hosts de subida adicionales.

## Imagen

El `Dockerfile` de la **raíz** del repositorio es el de staging (multi-etapa: build con
`node:22-slim`, runtime slim sirviendo `.output/` como usuario `node`). Este repositorio no
tiene `.docker/staging/`; esa ruta es del backend.

## Antes de publicar

1. Confirmar con el propietario el alcance y que se autoriza publicar.
2. Revisar el commit exacto, el PR y los checks verdes (`ci.yml`, `cypress.yml`,
   `documentation.yml`; ver [CI_CD.md](CI_CD.md)).
3. Si el cambio depende de un endpoint nuevo, publicar primero el backend.
4. Confirmar la etiqueta de respaldo de la imagen vigente.

## Publicar una imagen nueva

Construir desde `git archive` en un directorio temporal, no desde la carpeta de trabajo
(`COPY . .` metería archivos sin versionar). Los comandos usan variables del responsable
del entorno y un perfil de AWS con permisos de ECR y ECS.

```powershell
$repo = "209479293733.dkr.ecr.us-east-1.amazonaws.com/urbanblade/frontend-urban"
$sha  = git rev-parse --short HEAD
$tmp  = Join-Path $env:TEMP "frontend-$sha"
New-Item -ItemType Directory -Force $tmp | Out-Null
git archive $sha | tar -x -C $tmp
docker build -t "${repo}:latest" -t "${repo}:$sha" $tmp
(aws ecr get-login-password --region us-east-1) | docker login --username AWS --password-stdin 209479293733.dkr.ecr.us-east-1.amazonaws.com
docker push "${repo}:$sha"
docker push "${repo}:latest"
aws ecs update-service --cluster urbanblade-staging --service uba-stg-frontend --force-new-deployment --region us-east-1
```

Antes de empujar `latest`, guardar la imagen anterior con una etiqueta de respaldo
(`rollback-AAAAMMDD-pre-<sha>`) usando `aws ecr batch-get-image` y `aws ecr put-image`
(el manifiesto se pasa por `file://`, con `--image-manifest-media-type
application/vnd.oci.image.index.v1+json`). Esa etiqueta permite revertir.

## Verificar

```powershell
aws ecs wait services-stable --cluster urbanblade-staging --services uba-stg-frontend --region us-east-1
curl.exe -s -D - -o NUL https://urbanblade.com.mx/api/health
```

Durante el rollout hay un rato con tareas viejas y nuevas: verificar solo después de
`services-stable`. Una respuesta `200` no basta; comprobar la cabecera `Via: … (CloudFront)`
y recorrer a mano las pantallas del cambio con el rol afectado. CI verde no sustituye esa
evidencia.

## Revertir

Volver a etiquetar la imagen de respaldo como `latest`, subirla y forzar el despliegue con
el mismo `update-service`. Una reversión de imagen no deshace cambios del backend.

## Si el servicio no se estabiliza

- **`desired` ≠ `running`, sin eventos nuevos** (pasó el 24-oct-2026 con una tarea Spot
  interrumpida): la tarea suelta con la misma configuración arrancaba, así que el fallo
  estaba en el programador de ECS. Se resolvió respaldando la configuración del servicio y
  recreándolo. No hacerlo sin autorización del propietario.
- **502/504:** casi siempre viene del balanceador o de la tarea, no de CloudFront (sin caché
  aquí). Revisar los logs `/ecs/urbanblade-staging/frontend-urban`:

  ```powershell
  aws logs tail /ecs/urbanblade-staging/frontend-urban --region us-east-1 --since 30m
  ```

## Límites

- No ejecutar publicaciones, cambios de ECS ni de Terraform como parte de tareas documentales.
- El workflow de Terraform está pausado a petición del propietario; no reactivarlo sin que
  refleje el estado actual (frontend en FARGATE normal con el servicio recreado).
- No copiar a este repositorio valores de secretos ni inventarios privados.
