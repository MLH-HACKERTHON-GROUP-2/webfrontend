export class BackendError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'BackendError';
  }
}
