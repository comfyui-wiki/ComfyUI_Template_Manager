export function splitCoverArgs(options: { inputs: { name: string; video: boolean; x: number; y: number }[]; size: number; duration: number; quality: number; vertical: boolean; start?: number; speed?: number; fps?: number; fit?: string; overlay?: boolean }) {
  const { inputs, size, duration, quality, vertical } = options
  const start = options.start ?? 0, speed = options.speed ?? 1, fps = options.fps ?? 15
  const animated = inputs.some(input => input.video)
  const args = ['-y']
  inputs.forEach(input => args.push(...(input.video ? [] : ['-loop', '1']), '-i', input.name))
  if (options.overlay) args.push('-loop', '1', '-i', 'overlay.png')
  const w = vertical ? size : size / 2, h = vertical ? size / 2 : size
  const filters = inputs.map((input, i) => {
    const resize = options.fit === 'pad'
      ? `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`
      : `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)*${input.x}:(ih-oh)*${input.y}`
    return `[${i}:v]trim=start=${start}:duration=${duration},setpts=(PTS-STARTPTS)/${speed},${resize},setsar=1,fps=${fps}[p${i}]`
  })
  filters.push(`[p0][p1]${vertical ? 'vstack' : 'hstack'}=inputs=2:shortest=1[${options.overlay ? 'base' : 'out'}]`)
  if (options.overlay) filters.push('[base][2:v]overlay=0:0:format=auto:shortest=1[out]')
  args.push('-filter_complex', filters.join(';'), '-map', '[out]', '-t', String(duration / speed), '-an', '-c:v', 'libwebp', '-q:v', String(quality), '-loop', '0')
  if (!animated) args.push('-frames:v', '1')
  return [...args, 'split.webp']
}
