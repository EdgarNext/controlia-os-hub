export class RetailPosRuntimeError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "RetailPosRuntimeError";
    this.status = status;
  }
}
