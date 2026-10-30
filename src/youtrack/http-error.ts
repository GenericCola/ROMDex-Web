export class YouTrackHttpError extends Error {
  constructor(readonly status: number) {
    super("YouTrack request failed (HTTP " + status + ").");
  }
}
