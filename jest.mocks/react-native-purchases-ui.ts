export const PAYWALL_RESULT = {
  PURCHASED: 'PURCHASED',
  RESTORED: 'RESTORED',
  CANCELLED: 'CANCELLED',
  NOT_PRESENTED: 'NOT_PRESENTED',
  ERROR: 'ERROR',
};

const RevenueCatUI = {
  presentPaywallIfNeeded: async () => PAYWALL_RESULT.NOT_PRESENTED,
};

export default RevenueCatUI;
