/**
 * @author       Richard Davey <rich@phaser.io>
 * @copyright    2013-2026 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var SimulatePlayback = require('./SimulatePlayback');

/**
 * Works out which frame of an Animation is displayed at a given point in time.
 *
 * The `update` loop of an `AnimationState` moves playback forwards one `delta` at a time,
 * so the frame it ends up showing depends on how that time was split into steps. This
 * function instead walks the playback timeline directly, one tick at a time, which makes
 * it suitable for scrubbing a playhead or previewing an animation at any time, without
 * touching any live playback state.
 *
 * It re-uses the same `nextFrame` and `previousFrame` methods as real playback, so per-frame
 * durations, the opening `delay`, `yoyo`, `repeat` and `repeatDelay` all follow the runtime
 * rules exactly.
 *
 * Time is measured from the moment playback begins, in milliseconds, before any `timeScale`
 * is applied. If playback has not started yet, due to the opening delay, `null` is returned,
 * unless `showBeforeDelay` is set, in which case the first frame is returned. Once the
 * animation has completed, the frame it came to rest on is returned for any later time.
 *
 * @function Phaser.Animations.GetFrameAtTime
 * @since 4.3.0
 * @private
 *
 * @param {Phaser.Animations.Animation} anim - The Animation to evaluate.
 * @param {number} time - The time, in milliseconds, to get the frame for.
 * @param {Phaser.Types.Animations.FrameAtTimeConfig} [config] - Optional playback values to use in place of the Animation's own.
 *
 * @return {?Phaser.Animations.AnimationFrame} The frame displayed at the given time, or `null` if playback has not started.
 */
var GetFrameAtTime = function (anim, time, config)
{
    var state = SimulatePlayback(anim, time, config);

    return (state) ? state.currentFrame : null;
};

module.exports = GetFrameAtTime;
