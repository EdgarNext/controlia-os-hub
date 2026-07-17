export type KitchenMutationActionState = {
  error: string | null;
  success: string | null;
};

export const initialKitchenMutationActionState: KitchenMutationActionState = {
  error: null,
  success: null,
};
