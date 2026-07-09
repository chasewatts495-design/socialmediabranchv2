export class NotImplementedError extends Error {
  constructor(platform: string) {
    super(
      `Live publishing for ${platform} ships in a later phase — the account keeps working in demo mode meanwhile.`,
    );
    this.name = "NotImplementedError";
  }
}
