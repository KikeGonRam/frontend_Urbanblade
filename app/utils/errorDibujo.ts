/*
 * ¿El error ocurrió al DIBUJAR un componente? Vue lo indica en el tercer argumento de
 * onErrorCaptured: un texto en desarrollo y un código en producción
 * (https://vuejs.org/error-reference/#runtime-N): 0 = setup, 1 = render, 15 = actualización.
 * Errores de botones, eventos o watchers devuelven false.
 */
const FUENTES_DE_DIBUJO = new Set(['setup function', 'render function', 'component update'])
const CODIGOS_DE_DIBUJO = new Set(['0', '1', '15'])

export function esErrorDeDibujo(info: string): boolean {
  if (FUENTES_DE_DIBUJO.has(info)) return true
  const codigo = /#runtime-(\d+)$/.exec(info)?.[1]
  return codigo !== undefined && CODIGOS_DE_DIBUJO.has(codigo)
}
