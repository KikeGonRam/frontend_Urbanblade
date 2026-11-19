import type { IngenieroData } from "~/types/dashboard";

/** Telemetría agregada de pagos, pedidos, campañas, sorteos y muro, con 0 por defecto en cada campo. */
export function useEngineerModuleTelemetry(getData: () => IngenieroData) {
  const moduleTelemetry = computed(() => {
    const raw = getData().moduleTelemetry;

    return {
      windowDays: raw?.window_days ?? 0,
      payments: {
        verified: raw?.payments?.verified_month ?? 0,
        pending: raw?.payments?.pending_review ?? 0,
        rejected: raw?.payments?.rejected_month ?? 0,
        amount: raw?.payments?.amount_month ?? 0,
      },
      orders: {
        pending: raw?.orders?.pending ?? 0,
        delivered: raw?.orders?.delivered_month ?? 0,
        cancelled: raw?.orders?.cancelled_month ?? 0,
      },
      campaigns: {
        scheduled: raw?.campaigns?.scheduled ?? 0,
        sent: raw?.campaigns?.sent_month ?? 0,
        recipients: raw?.campaigns?.recipients_month ?? 0,
        opens: raw?.campaigns?.opens_month ?? 0,
        clicks: raw?.campaigns?.clicks_month ?? 0,
      },
      raffles: {
        redeemable: raw?.raffles?.redeemable ?? 0,
        claimed: raw?.raffles?.claimed_month ?? 0,
        expired: raw?.raffles?.expired_unclaimed ?? 0,
      },
      social: {
        works: raw?.social?.works_month ?? 0,
        reactions: raw?.social?.reactions_month ?? 0,
        comments: raw?.social?.comments_month ?? 0,
        saves: raw?.social?.saves_month ?? 0,
      },
    };
  });

  return { moduleTelemetry };
}
