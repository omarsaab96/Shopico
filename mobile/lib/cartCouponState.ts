import type { CartCouponOffer } from "./cartCouponTeaser";

export type CartCouponState = {
  scope: string;
  offer: CartCouponOffer | null;
  loading: boolean;
  presentation: number;
};

export function updateCartCouponState(previous: CartCouponState, scope: string, offer: CartCouponOffer | null): CartCouponState {
  return {
    scope, offer, loading: false,
    presentation: previous.presentation + (previous.scope !== scope || previous.offer?._id !== offer?._id ? 1 : 0),
  };
}
