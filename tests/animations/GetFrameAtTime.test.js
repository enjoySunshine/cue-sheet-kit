var Animation = require('../../src/animations/Animation');
var GetFrameAtTime = require('../../src/animations/GetFrameAtTime');
var SimulatePlayback = require('../../src/animations/SimulatePlayback');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockManager ()
{
    return {
        textureManager: {
            exists: function () { return false; },
            get: function () { return null; },
            getFrame: function () { return null; }
        },
        on: vi.fn(),
        off: vi.fn(),
        remove: vi.fn()
    };
}

/**
 * Builds a real Animation with frames that have the given durations.
 * The frames are linked and given progress values, so the Animation methods
 * can be exercised for real.
 */
function createAnimation (durations, config)
{
    var anim = new Animation(createMockManager(), 'test-anim', Object.assign({ frames: [] }, config || {}));

    var frames = [];

    for (var i = 0; i < durations.length; i++)
    {
        frames.push({
            index: i + 1,
            textureFrame: i,
            duration: durations[i],
            isFirst: false,
            isLast: false,
            nextFrame: null,
            prevFrame: null,
            progress: i / (durations.length - 1),
            frame: { texture: {}, customPivot: false, updateCropUVs: function () {} }
        });
    }

    for (var c = 0; c < frames.length; c++)
    {
        frames[c].isFirst = (c === 0);
        frames[c].isLast = (c === frames.length - 1);
        frames[c].prevFrame = frames[(c - 1 + frames.length) % frames.length];
        frames[c].nextFrame = frames[(c + 1) % frames.length];
    }

    anim.frames = frames;

    return anim;
}

/**
 * The four frame walk animation from the spec:
 * 4 frames at 80, 120, 40 and 200 ms, 10 fps, 30 ms opening delay,
 * yoyo, one repeat, 50 ms repeat delay.
 */
function createWalkAnimation ()
{
    return createAnimation([ 80, 120, 40, 200 ], {
        frameRate: 10,
        delay: 30,
        yoyo: true,
        repeat: 1,
        repeatDelay: 50
    });
}

/**
 * The three frame animation from the spec: no yoyo, no repeat, no delay,
 * 80, 120 and 40 ms durations at 5 fps.
 */
function createSimpleAnimation ()
{
    return createAnimation([ 80, 120, 40 ], { frameRate: 5 });
}

function frameNumber (frame)
{
    return (frame === null) ? null : frame.textureFrame;
}

// ---------------------------------------------------------------------------
// GetFrameAtTime
// ---------------------------------------------------------------------------

describe('GetFrameAtTime', function ()
{
    describe('with a yoyo animation that repeats once', function ()
    {
        var anim;

        beforeEach(function ()
        {
            anim = createWalkAnimation();
        });

        it('should return null before the opening delay has expired', function ()
        {
            expect(GetFrameAtTime(anim, 0)).toBeNull();
            expect(GetFrameAtTime(anim, 29)).toBeNull();
        });

        it('should return the first frame the moment the delay expires', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 30))).toBe(0);
            expect(frameNumber(GetFrameAtTime(anim, 109))).toBe(0);
        });

        it('should move to frame 1 after 80 ms of frame 0', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 110))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 229))).toBe(1);
        });

        it('should move to frame 2 after 120 ms of frame 1', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 230))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 269))).toBe(2);
        });

        it('should move to frame 3 after 40 ms of frame 2', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 270))).toBe(3);
            expect(frameNumber(GetFrameAtTime(anim, 469))).toBe(3);
        });

        it('should reverse after the last frame, starting with frame 2', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 470))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 509))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 510))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 629))).toBe(1);
        });

        it('should return to frame 0 at the end of the reverse pass', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 630))).toBe(0);
            expect(frameNumber(GetFrameAtTime(anim, 839))).toBe(0);
        });

        it('should apply the repeat delay, then play forwards again', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 840))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 959))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 960))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 999))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 1000))).toBe(3);
            expect(frameNumber(GetFrameAtTime(anim, 1199))).toBe(3);
        });

        it('should reverse on the second pass as well', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 1200))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 1239))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 1240))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 1359))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 1360))).toBe(0);
        });

        it('should still be playing at 1439 ms, showing frame 0', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 1439))).toBe(0);
        });

        it('should have stopped at 1440 ms, holding frame 0', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 1440))).toBe(0);
        });

        it('should hold the resting frame for any time after completion', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 5000))).toBe(0);
        });

        it('should answer individual milliseconds exactly as the recorded timeline', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 500))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 900))).toBe(1);
        });

        it('should return null for a negative time', function ()
        {
            expect(GetFrameAtTime(anim, -1)).toBeNull();
        });

        it('should return the first frame for a negative time when showBeforeDelay is set', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, -1, { showBeforeDelay: true }))).toBe(0);
        });

        it('should return null for NaN', function ()
        {
            expect(GetFrameAtTime(anim, NaN)).toBeNull();
        });
    });

    describe('with a simple animation', function ()
    {
        var anim;

        beforeEach(function ()
        {
            anim = createSimpleAnimation();
        });

        it('should start on frame 0 immediately, because there is no delay', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 0))).toBe(0);
            expect(frameNumber(GetFrameAtTime(anim, 79))).toBe(0);
        });

        it('should switch to frame 1 at 80 ms', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 80))).toBe(1);
            expect(frameNumber(GetFrameAtTime(anim, 199))).toBe(1);
        });

        it('should switch to frame 2 at 200 ms', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 200))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 239))).toBe(2);
        });

        it('should stop at 240 ms on the last frame', function ()
        {
            expect(frameNumber(GetFrameAtTime(anim, 240))).toBe(2);
            expect(frameNumber(GetFrameAtTime(anim, 5000))).toBe(2);
        });
    });

    describe('with edge cases', function ()
    {
        it('should return null when the animation has no frames', function ()
        {
            var anim = createAnimation([]);

            expect(GetFrameAtTime(anim, 0)).toBeNull();
        });

        it('should return the first frame for time 0 when there is no delay', function ()
        {
            var anim = createAnimation([ 100, 100 ], { frameRate: 10 });

            expect(frameNumber(GetFrameAtTime(anim, 0))).toBe(0);
        });

        it('should use a single frame animation without advancing', function ()
        {
            var anim = createAnimation([ 100 ], { frameRate: 10, repeat: -1 });

            expect(frameNumber(GetFrameAtTime(anim, 0))).toBe(0);
            expect(frameNumber(GetFrameAtTime(anim, 5000))).toBe(0);
        });

        it('should return null during the delay unless showBeforeDelay is set', function ()
        {
            var anim = createAnimation([ 100, 100 ], { frameRate: 10, delay: 250 });

            expect(GetFrameAtTime(anim, 249)).toBeNull();
            expect(frameNumber(GetFrameAtTime(anim, 249, { showBeforeDelay: true }))).toBe(0);
        });

        it('should allow playback values to be overridden by the config', function ()
        {
            var anim = createSimpleAnimation();

            //  A different frame rate overrides the per-frame durations, so every
            //  frame lasts 1000 / 4 = 250 ms, and at 500 ms the last frame is showing
            var frame = GetFrameAtTime(anim, 500, { frameRate: 4 });

            expect(frameNumber(frame)).toBe(2);
        });

        it('should return the frames of the Animation instance', function ()
        {
            var anim = createSimpleAnimation();

            expect(GetFrameAtTime(anim, 0)).toBe(anim.frames[0]);
        });
    });
});

// ---------------------------------------------------------------------------
// SimulatePlayback
// ---------------------------------------------------------------------------

describe('SimulatePlayback', function ()
{
    it('should report the playback state as well as the frame', function ()
    {
        var anim = createWalkAnimation();
        var state = SimulatePlayback(anim, 500);

        expect(frameNumber(state.currentFrame)).toBe(2);
        expect(state.forward).toBe(false);
        expect(state.isPlaying).toBe(true);
    });

    it('should report that playback has completed after the end', function ()
    {
        var anim = createWalkAnimation();
        var state = SimulatePlayback(anim, 1440);

        expect(state.isPlaying).toBe(false);
        expect(frameNumber(state.currentFrame)).toBe(0);
    });

    it('should not have started during the opening delay', function ()
    {
        var anim = createWalkAnimation();
        var state = SimulatePlayback(anim, 0);

        expect(state.hasStarted).toBe(false);
        expect(state.currentFrame).toBeNull();
    });

    it('should report a pending repeat during the repeat delay', function ()
    {
        var anim = createWalkAnimation();

        //  840 ms is just after the repeat delay has expired, 839 is inside it
        var inside = SimulatePlayback(anim, 839);
        var outside = SimulatePlayback(anim, 840);

        expect(inside.pendingRepeat).toBe(true);
        expect(outside.pendingRepeat).toBe(false);
    });

    it('should return null for NaN', function ()
    {
        var anim = createWalkAnimation();

        expect(SimulatePlayback(anim, NaN)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Animation#getFrameAtTime
// ---------------------------------------------------------------------------

describe('Animation#getFrameAtTime', function ()
{
    it('should return the same frame as the GetFrameAtTime function', function ()
    {
        var anim = createWalkAnimation();

        expect(anim.getFrameAtTime(500)).toBe(GetFrameAtTime(anim, 500));
        expect(anim.getFrameAtTime(840)).toBe(GetFrameAtTime(anim, 840));
    });

    it('should return null before playback starts', function ()
    {
        var anim = createWalkAnimation();

        expect(anim.getFrameAtTime(0)).toBeNull();
    });

    it('should accept a config that overrides the playback values', function ()
    {
        var anim = createSimpleAnimation();

        //  At 4 fps the frames each last 250 ms, so 500 ms is the last frame
        expect(frameNumber(anim.getFrameAtTime(500, { frameRate: 4 }))).toBe(2);
    });

    it('should not be affected by the progress based lookup', function ()
    {
        var anim = createWalkAnimation();

        //  Progress 0.5 lands on frame 2 of the four frames, but at 500 ms
        //  the playhead is on frame 2 of the reverse pass. They are different
        //  reads of the same animation.
        expect(anim.getFrameByProgress(0.5).textureFrame).toBe(2);
        expect(frameNumber(anim.getFrameAtTime(500))).toBe(2);
        expect(frameNumber(anim.getFrameAtTime(900))).toBe(1);
    });

    it('should offer getFrameByTime as an alias of getFrameAtTime', function ()
    {
        var anim = createWalkAnimation();

        expect(anim.getFrameByTime(500)).toBe(anim.getFrameAtTime(500));
        expect(anim.getFrameByTime(840)).toBe(anim.getFrameAtTime(840));
    });
});

// ---------------------------------------------------------------------------
// Animation#simulatePlayback
// ---------------------------------------------------------------------------

describe('Animation#simulatePlayback', function ()
{
    it('should return a playback state matching the time', function ()
    {
        var anim = createWalkAnimation();
        var state = anim.simulatePlayback(1440);

        expect(state.isPlaying).toBe(false);
        expect(frameNumber(state.currentFrame)).toBe(0);
    });

    it('should return null when there are no frames', function ()
    {
        var anim = createAnimation([]);

        expect(anim.simulatePlayback(0)).toBeNull();
    });
});
