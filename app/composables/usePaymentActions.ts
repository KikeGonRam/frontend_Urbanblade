import type { PaymentRow } from "~/types/payments";

/*
 * Acciones por fila del historial: ver comprobante y anular cobro.
 * Anular borra el cobro y su comprobante: solo el administrador, y con motivo
 * (queda en la bitácora).
 */
export function usePaymentActions(refresh: () => Promise<unknown>) {
  const { apiFetch } = useApi();

  const actionError = ref("");
  const voiding = ref<PaymentRow | null>(null);
  const voidReason = ref("");
  const voidBusy = ref(false);
  const voidError = ref("");

  async function viewReceipt(payment: PaymentRow) {
    if (payment.receipt_url) {
      window.open(payment.receipt_url, "_blank");

      return;
    }

    try {
      const res = await apiFetch<{ data: { receipt_url: string } }>(
        `/payments/${payment.id}/receipt`,
      );
      window.open(res.data.receipt_url, "_blank");
    } catch (err: unknown) {
      actionError.value =
        (err as { data?: { message?: string } })?.data?.message ??
        "No se pudo generar el comprobante.";
    }
  }

  function removePayment(payment: PaymentRow) {
    voidReason.value = "";
    voidError.value = "";
    voiding.value = payment;
  }

  async function confirmVoid() {
    const payment = voiding.value;
    if (!payment) return;
    if (voidReason.value.trim().length < 5) {
      voidError.value = "Escribe el motivo (mínimo 5 caracteres).";
      return;
    }

    voidBusy.value = true;
    voidError.value = "";
    actionError.value = "";
    try {
      await apiFetch(`/payments/${payment.id}`, {
        method: "DELETE",
        body: { motivo: voidReason.value.trim() },
      });
      voiding.value = null;
      await refresh();
    } catch (err: unknown) {
      voidError.value =
        (err as { data?: { message?: string } })?.data?.message ??
        "No se pudo anular el comprobante.";
    } finally {
      voidBusy.value = false;
    }
  }

  async function onRowAction(action: string, payment: PaymentRow) {
    if (action === "pdf") await viewReceipt(payment);
    else if (action === "void") removePayment(payment);
  }

  return {
    actionError,
    voiding,
    voidReason,
    voidBusy,
    voidError,
    confirmVoid,
    onRowAction,
  };
}
