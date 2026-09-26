/** Opción de `UiChoiceCards` (ver skill urbanblade-ui-kit). */
export interface ChoiceOption<T extends string = string> {
  value: T;
  title: string;
  detail?: string;
  icon?: "efectivo" | "transferencia" | "tarjeta" | "salon";
  disabled?: boolean;
}
