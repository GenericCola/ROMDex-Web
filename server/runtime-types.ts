export interface Tokens {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}
export interface Identity {
  id: string;
  guest: boolean;
  projects: { id: string; name: string; shortName: string }[];
}
export interface OAuthPort {
  exchange(code: string, verifier: string, callback: string): Promise<Tokens>;
  refresh(refreshToken: string): Promise<Tokens>;
  verify(accessToken: string): Promise<Identity>;
}
export class HttpFailure extends Error {
  status: number;
  constructor(status: number) {
    super("Authentication request failed");
    this.status = status;
  }
}
