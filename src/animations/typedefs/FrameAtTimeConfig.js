/**
 * @typedef {object} Phaser.Types.Animations.FrameAtTimeConfig
 * @since 4.3.0
 *
 * @property {number} [frameRate] - The frame rate of playback in frames per second, overriding the Animation's own.
 * @property {number} [msPerFrame] - The number of milliseconds per frame, overriding the value derived from the frame rate.
 * @property {number} [delay] - Delay before playback starts, in milliseconds. Overrides the Animation's own.
 * @property {number} [repeat] - Number of times to repeat the animation (-1 for infinity). Overrides the Animation's own.
 * @property {number} [repeatDelay] - Delay before the animation repeats, in milliseconds. Overrides the Animation's own.
 * @property {boolean} [yoyo] - Should the animation yoyo before repeating? Overrides the Animation's own.
 * @property {boolean} [showBeforeDelay] - If the animation has a delay, should it show its first frame during the delay?
 * @property {number} [startFrame] - The frame index to begin playback from.
 */
