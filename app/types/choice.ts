/** Opción de `UiChoiceCards` (ver skill urbanblade-ui-kit). */
export interface ChoiceOption<T extends string = string> {
  value: T;
  title: string;
  detail?: string;
  /** Los cuatro de pago (trazos propios) o cualquier nombre de `UiIcon`. */
  icon?: string;
  disabled?: boolean;
}
