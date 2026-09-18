// Endpoint minimo de salud para el HEALTHCHECK del contenedor Docker y para
// un futuro Target Group/Load Balancer en AWS. No depende del backend de
// barber ni de ninguna base de datos -- solo confirma que el proceso Node
// de Nitro esta vivo y respondiendo.
export default defineEventHandler(() => {
  return { status: 'ok' }
})
