import { describe, expect, it } from 'vitest'
import { splitCoverArgs } from '../../lib/thumbnail-split'
describe('split cover encoding', () => {
  for (const types of [[false, false], [true, true], [false, true]]) {
    it(`composes ${types} with focus and a bounded timeline`, () => {
      const args = splitCoverArgs({ inputs: types.map((video, i) => ({ video, name: `input${i}`, x: .25, y: .75 })), size: 400, duration: 3, quality: 95, vertical: false })
      const filter = args[args.indexOf('-filter_complex') + 1]
      expect(filter).toContain('crop=200:400:(iw-ow)*0.25:(ih-oh)*0.75')
      expect(filter).toContain('hstack=inputs=2:shortest=1')
      expect(args.includes('-frames:v')).toBe(!types.some(Boolean))
      expect(args[args.indexOf('-t') + 1]).toBe('3')
    })
  }
})

it('exports timeline, speed, compression and overlay together', () => {
  const args = splitCoverArgs({ inputs: [0, 1].map(i => ({ name: `input${i}`, video: true, x: .5, y: .5 })), size: 350, duration: 6, start: 2, speed: 3, fps: 10, quality: 70, fit: 'pad', vertical: true, overlay: true })
  const filter = args[args.indexOf('-filter_complex') + 1]
  expect(filter).toContain('trim=start=2:duration=6,setpts=(PTS-STARTPTS)/3')
  expect(filter).toContain('pad=350:175')
  expect(filter).toContain('fps=10')
  expect(filter).toContain('[base][2:v]overlay=0:0')
  expect(args[args.indexOf('-t') + 1]).toBe('2')
  expect(args[args.indexOf('-q:v') + 1]).toBe('70')
  expect(args).toContain('overlay.png')
})
