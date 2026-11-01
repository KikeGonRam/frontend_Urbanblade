# Imagen de PRODUCCION/STAGING para AWS. No existia ningun Dockerfile antes
# de esto -- en desarrollo local solo se usa "npm run dev" directo, sin
# contenedor (ver README). Multi-stage: build con Node completo, runtime con
# la imagen slim, sirviendo el .output/ generado por "nuxt build" (preset
# node-server, el default de Nuxt para SSR fuera de Vercel/Netlify).
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci fallo aqui: package-lock.json esta desincronizado de package.json
# (falta "srvx@1.0.5") con el npm que trae node:22-slim, aunque npm local
# del desarrollador no lo marca como error. npm install es mas tolerante a
# ese drift -- no es tan estricto como ci, pero no bloquea el build por un
# lockfile que ya estaba desactualizado antes de este Dockerfile.
RUN npm install

COPY . .
# NUXT_PUBLIC_API_BASE/NUXT_PUBLIC_STRIPE_KEY se leen en runtime (server
# entry point), no hace falta pasarlas como build args aqui.
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build --chown=node:node /app/.output ./.output

# El servidor solo ejecuta `node .output/server/index.mjs`: no usa npm, npx ni corepack. Esas herramientas vienen con la imagen
# base y traen sus propias dependencias (brace-expansion, pacote, sigstore, ip-address, picomatch), que los escaneos reportan
# como vulnerabilidades altas aunque la app nunca las ejecute. Quitarlas elimina esa superficie de ataque (y ~18 MB).
# La etapa de construccion si las necesita y no se toca.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# El servidor no necesita privilegios (puerto 3000, no escribe fuera de memoria): corre
# como el usuario `node` que ya trae la imagen, no como root, para que un fallo en la app
# no entregue el contenedor completo.
USER node

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=8 --start-period=30s \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
