export const MIN_PLAYBACK_SPEED = 1
export const MAX_PLAYBACK_SPEED = 16

export function clampPlaybackSpeed(speed: number): number {
  if (!Number.isFinite(speed) || speed <= MIN_PLAYBACK_SPEED) return MIN_PLAYBACK_SPEED
  return Math.min(MAX_PLAYBACK_SPEED, speed)
}

export function outputDurationSeconds(sourceDuration: number, speed: number): number {
  const source = Math.max(0.05, sourceDuration)
  return source / clampPlaybackSpeed(speed)
}

/** Speed needed to compress `sourceDuration` into `targetSeconds`. Stays at 1x if already shorter. */
export function speedToFitDuration(sourceDuration: number, targetSeconds: number): number {
  const source = Math.max(0.05, sourceDuration)
  const target = Math.max(0.05, targetSeconds)
  if (source <= target) return MIN_PLAYBACK_SPEED
  return clampPlaybackSpeed(Math.round((source / target) * 10) / 10)
}

/** Prefix setpts so FFmpeg speeds up the clip. 1x leaves the filter unchanged. */
export function withPlaybackSpeedFilter(filter: string, speed: number): string {
  const clamped = clampPlaybackSpeed(speed)
  if (clamped <= 1.001) return filter
  return `setpts=PTS/${Number(clamped.toFixed(3))},${filter}`
}
