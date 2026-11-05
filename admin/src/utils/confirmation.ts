export interface Confirmation {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}
export type ConfirmationRequest = Confirmation & { resolve: (confirmed: boolean) => void };
let present: ((request: ConfirmationRequest) => void) | undefined;

export function confirmAction(options: Confirmation): Promise<boolean> {
  return new Promise(resolve => {
    if (present) present({ ...options, resolve });
    else resolve(false);
  });
}

export function registerConfirmationHost(handler: (request: ConfirmationRequest) => void) {
  present = handler;
  return () => { if (present === handler) present = undefined; };
}
