/**
 * @author       Richard Davey <rich@phaser.io>
 * @copyright    2013-2026 Phaser Studio Inc.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

/**
 * Fast-forwards a throw-away playback state to the given time.
 *
 * The returned object has the same shape as an `AnimationState`, with `currentFrame`,
 * `forward`, `pendingRepeat`, `accumulator`, `nextTick` and `repeatCounter` all set to
 * the values they would have if the animation had been played up to `time` one tick at
 * a time. The caller can use it to read the frame, or to bring a live `AnimationState`
 * up to that point (see `AnimationState.setTime`).
 *
 * The animation's own `nextFrame` and `previousFrame` methods are used, so the result is
 * guaranteed to agree with real playback.
 *
 * @function Phaser.Animations.SimulatePlayback
 * @since 4.3.0
 * @private
 *
 * @param {Phaser.Animations.Animation} anim - The Animation to simulate.
 * @param {number} time - The time, in milliseconds, to simulate up to.
 * @param {Phaser.Types.Animations.FrameAtTimeConfig} [config] - The playback values to use in place of the Animation's own.
 *
 * @return {?Phaser.Animations.AnimationState} A simulated AnimationState, or `null` if the time is not valid or there are no frames.
 */
var SimulatePlayback = function (anim, time, config)
{
    var frames = anim.frames;

    if (!frames || frames.length === 0 || typeof time !== 'number' || Number.isNaN(time))
    {
        return null;
    }

    if (config === undefined)
    {
        config = {};
    }

    var delay = (config.delay !== undefined) ? config.delay : anim.delay;
    var repeat = (config.repeat !== undefined) ? config.repeat : anim.repeat;
    var repeatDelay = (config.repeatDelay !== undefined) ? config.repeatDelay : anim.repeatDelay;
    var yoyo = (config.yoyo !== undefined) ? config.yoyo : anim.yoyo;
    var frameRate = (config.frameRate !== undefined) ? config.frameRate : anim.frameRate;
    var msPerFrame = (config.msPerFrame !== undefined) ? config.msPerFrame : (1000 / frameRate);
    var showBeforeDelay = (config.showBeforeDelay !== undefined) ? config.showBeforeDelay : anim.showBeforeDelay;
    var startFrame = (config.startFrame !== undefined) ? config.startFrame : 0;

    if (!(startFrame >= 0 && startFrame < frames.length))
    {
        startFrame = 0;
    }

    var firstFrame = frames[startFrame];

    var delayTime = (delay > 0) ? delay : 0;

    var state = {
        currentAnim: anim,
        currentFrame: firstFrame,
        frameRate: frameRate,
        msPerFrame: msPerFrame,
        accumulator: 0,
        nextTick: 0,
        yoyo: yoyo,
        repeatCounter: (repeat === -1) ? Number.MAX_VALUE : repeat,
        repeatDelay: repeatDelay,
        pendingRepeat: false,
        inReverse: false,
        forward: true,
        isPlaying: true,
        hasStarted: true,
        time: 0,
        _pendingStop: 0,
        _pendingStopValue: 0,

        setCurrentFrame: function (frame)
        {
            this.currentFrame = frame;
        },

        complete: function ()
        {
            this.isPlaying = false;
        },

        stop: function ()
        {
            this.isPlaying = false;
        },

        handleRepeat: function ()
        {
            //  Matches AnimationState.handleRepeat, minus the event emission
            this.pendingRepeat = false;
        }
    };

    //  Use the same first tick calculation as a real play through
    anim.getFirstTick(state);

    if (time < delayTime)
    {
        //  Playback has not begun yet. This also covers a negative time.
        state.hasStarted = false;
        state.accumulator = Math.max(time, 0);
        state.time = 0;

        if (!showBeforeDelay)
        {
            state.currentFrame = null;
        }

        return state;
    }

    //  Playback effectively begins once the opening delay has expired
    var boundary = delayTime;

    var safetyNet = 0;

    while (state.isPlaying)
    {
        var tick = state.nextTick - state.accumulator;

        if (!(tick > 0) || safetyNet++ > 1000000)
        {
            //  A zero-length tick (or a runaway timeline) must not spin forever
            break;
        }

        if (time < boundary + tick)
        {
            break;
        }

        boundary += tick;

        //  Move the accumulator to the tick boundary, exactly as a delta of 'tick' would
        state.accumulator = state.nextTick;

        if (state.forward)
        {
            anim.nextFrame(state);
        }
        else
        {
            anim.previousFrame(state);
        }
    }

    if (state.isPlaying)
    {
        //  Keep the part of the current frame that has already elapsed, so that
        //  playback can carry on from this point with its normal update loop.
        state.accumulator = time - boundary;
    }

    state.time = time;

    return state;
};

module.exports = SimulatePlayback;
