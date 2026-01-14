import { useQuery } from '@tanstack/react-query';
import { apiEntitlements } from '../api';

export const useEntitlements = () => {
  return useQuery({
    queryKey: ['entitlements'],
    queryFn: async () => {
      const res = await apiEntitlements.list();
      return res.data.data || (res.data as any);
    },
  });
};

export const hasAccessToCentre = (entitlements: any[] | undefined, centreId?: string) => {
  if (!entitlements) return false;
  const now = new Date();
  return entitlements.some((ent) => {
    const endsAt = ent.endsAt ? new Date(ent.endsAt) : null;
    const active = !endsAt || endsAt > now;
    if (!active) return false;
    return ent.scope === 'GLOBAL' || (ent.scope === 'CENTRE' && ent.centreId === centreId);
  });
};
