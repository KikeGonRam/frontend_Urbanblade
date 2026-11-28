/*
 * T053 (HT-19): cambio con un ERROR DE LINT A PROPÓSITO (variable sin usar) para comprobar que el pipeline queda en
 * rojo y no deja integrar el cambio (RNF-19). NO FUSIONAR: esta rama solo existe para la prueba y se borra al terminar.
 */
export function t053Saludo(nombre: string): string {
  const variableSinUsar = "error de lint a propósito";
  return `Hola, ${nombre}`;
}
