var Animation = require('../../src/animations/Animation');
var AnimationState = require('../../src/animations/AnimationState');

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
            frame: {
                texture: {},
                customPivot: false,
                updateCropUVs: function () {}
            }
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

function createAnimationManager ()
{
    return {
        textureManager: {},
        globalTimeScale: 1,
        on: function () {},
        off: function () {},
        get: function () { return null; },
        getMix: function () { return 0; }
    };
}

function createParent ()
{
    return {
        scene: { sys: { anims: createAnimationManager() } },
        texture: null,
        frame: null,
        isCropped: false,
        _originComponent: false,
        flipX: false,
        flipY: false,
        alpha: 1,
        visible: true,
        setVisible: function () {},
        setSizeToFrame: function () {},
        updateDisplayOrigin: function () {},
        setOrigin: function () {},
        emit: function () {}
    };
}

/**
 * Builds an AnimationState with the animation loaded and its playback values set,
 * as `startAnimation` would leave it.
 */
function createState (anim)
{
    var state = new AnimationState(createParent());

    state.currentAnim = anim;
    state.currentFrame = anim.frames[0];
    state.frameRate = anim.frameRate;
    state.msPerFrame = anim.msPerFrame;
    state.duration = anim.duration;
    state.delay = anim.delay;
    state.repeat = anim.repeat;
    state.repeatCounter = (anim.repeat === -1) ? Number.MAX_VALUE : anim.repeat;
    state.repeatDelay = anim.repeatDelay;
    state.yoyo = anim.yoyo;
    state.showBeforeDelay = anim.showBeforeDelay;
    state.isPlaying = true;
    state.forward = true;
    state.inReverse = false;
    state.accumulator = 0;
    state.nextTick = 0;
    state.delayCounter = anim.delay;

    anim.getFirstTick(state);

    return state;
}

function createWalkState ()
{
    return createState(createAnimation([ 80, 120, 40, 200 ], {
        frameRate: 10,
        delay: 30,
        yoyo: true,
        repeat: 1,
        repeatDelay: 50
    }));
}

function frameNumber (frame)
{
    return (frame === null) ? null : frame.textureFrame;
}

// ---------------------------------------------------------------------------
// AnimationState#getFrameAtTime
// ---------------------------------------------------------------------------

describe('AnimationState#getFrameAtTime', function ()
{
    it('should return null when no animation is loaded', function ()
    {
        var state = new AnimationState(createParent());

        expect(state.getFrameAtTime(0)).toBeNull();
    });

    it('should use the playback values currently held by the state', function ()
    {
        var state = createWalkState();

        //  The state has a 30 ms delay and a 10 fps frame rate
        expect(state.getFrameAtTime(29)).toBeNull();
        expect(frameNumber(state.getFrameAtTime(30))).toBe(0);
        expect(frameNumber(state.getFrameAtTime(840))).toBe(1);
    });

    it('should agree with a one millisecond playback at every step', function ()
    {
        var state = createWalkState();
        var reference = createWalkState();

        //  The reference is driven from time 0, one millisecond at a time
        for (var t = 0; t < 1500; t++)
        {
            reference.update(t, 1);

            //  Before the opening delay has expired there is no frame of this
            //  animation on screen, so the comparison starts once it begins.
            if (t + 1 >= 30)
            {
                expect(frameNumber(state.getFrameAtTime(t + 1))).toBe(frameNumber(reference.currentFrame));
            }
        }
    });

    it('should not change the state of playback', function ()
    {
        var state = createWalkState();

        state.accumulator = 12;
        state.nextTick = 80;

        state.getFrameAtTime(1400);

        expect(state.accumulator).toBe(12);
        expect(state.nextTick).toBe(80);
        expect(state.currentFrame).toBe(state.currentAnim.frames[0]);
        expect(state.isPlaying).toBe(true);
        expect(state.forward).toBe(true);
    });

    it('should allow the playback values to be overridden', function ()
    {
        var state = createWalkState();

        //  Skip the delay by overriding it
        expect(frameNumber(state.getFrameAtTime(0, { delay: 0 }))).toBe(0);
    });

    it('should offer getFrameByTime as an alias of getFrameAtTime', function ()
    {
        var state = createWalkState();

        expect(state.getFrameByTime(500)).toBe(state.getFrameAtTime(500));
    });
});

// ---------------------------------------------------------------------------
// AnimationState#setTime
// ---------------------------------------------------------------------------

describe('AnimationState#setTime', function ()
{
    it('should set the frame that matches the given time', function ()
    {
        var state = createWalkState();

        state.setTime(840);

        expect(frameNumber(state.currentFrame)).toBe(1);
    });

    it('should set the frame during the reverse pass', function ()
    {
        var state = createWalkState();

        state.setTime(500);

        expect(frameNumber(state.currentFrame)).toBe(2);
        expect(state.forward).toBe(false);
    });

    it('should copy the timing values so playback continues correctly', function ()
    {
        var state = createWalkState();
        var reference = createWalkState();

        //  Bring the reference to 840 ms the slow way, then seek the other one
        for (var t = 0; t < 840; t++)
        {
            reference.update(t, 1);
        }

        state.setTime(840);

        expect(frameNumber(state.currentFrame)).toBe(frameNumber(reference.currentFrame));

        //  From here both should step forwards through the timeline identically
        for (var s = 840; s < 1400; s++)
        {
            state.update(s, 1);
            reference.update(s, 1);

            expect(frameNumber(state.currentFrame)).toBe(frameNumber(reference.currentFrame));
        }
    });

    it('should continue correctly when seeking during the opening delay', function ()
    {
        var reference = createWalkState();
        var state = createWalkState();

        //  Play the reference up to 20 ms, one millisecond at a time. This is
        //  still inside the 30 ms opening delay.
        for (var t = 0; t < 20; t++)
        {
            reference.update(t, 1);
        }

        state.setTime(20);

        expect(state.hasStarted).toBe(false);

        //  Step both forward and they must stay in step
        for (var s = 20; s < 200; s++)
        {
            reference.update(s, 1);
            state.update(s, 1);

            expect(frameNumber(state.currentFrame)).toBe(frameNumber(reference.currentFrame));
        }
    });

    it('should hold the resting frame after the animation has completed', function ()
    {
        var state = createWalkState();

        state.setTime(5000);

        expect(frameNumber(state.currentFrame)).toBe(0);
    });

    it('should clamp a negative time to the start of playback', function ()
    {
        var state = createWalkState();

        //  At time 0 the opening delay has not expired, so nothing changes
        state.setTime(-100);

        expect(state.hasStarted).toBe(false);
        expect(state.accumulator).toBe(0);
        expect(frameNumber(state.currentFrame)).toBe(0);
    });

    it('should return the parent game object', function ()
    {
        var state = createWalkState();

        expect(state.setTime(100)).toBe(state.parent);
    });

    it('should do nothing when no animation is loaded', function ()
    {
        var state = new AnimationState(createParent());

        expect(state.setTime(100)).toBe(state.parent);
        expect(state.currentFrame).toBeNull();
    });

    it('should leave the playhead at the same frame as a one millisecond playback', function ()
    {
        var state = createWalkState();
        var reference = createWalkState();

        for (var t = 0; t < 1500; t++)
        {
            reference.update(t, 1);

            if (t + 1 >= 30)
            {
                state.setTime(t + 1);

                expect(frameNumber(state.currentFrame)).toBe(frameNumber(reference.currentFrame));
            }
        }
    });
});
