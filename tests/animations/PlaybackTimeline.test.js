var Animation = require('../../src/animations/Animation');
var AnimationState = require('../../src/animations/AnimationState');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createAnimationManager ()
{
    var manager = {
        textureManager: {},
        globalTimeScale: 1,
        listeners: {},
        on: function (event, cb, ctx)
        {
            (manager.listeners[event] = manager.listeners[event] || []).push([ cb, ctx ]);
        },
        off: function () {},
        emit: function (event)
        {
            (manager.listeners[event] || []).forEach(function (entry)
            {
                entry[0].call(entry[1]);
            });
        },
        get: function () { return null; },
        getMix: function () { return 0; }
    };

    return manager;
}

function createTextureManager (frameCount)
{
    return {
        exists: function () { return true; },
        get: function () { return { getFrameNames: function () { return []; } }; },
        getFrame: function (key, index)
        {
            return {
                texture: { key: key },
                name: 'frame' + index,
                customPivot: false,
                updateCropUVs: function () {}
            };
        }
    };
}

/**
 * Builds an animation the same way the Animation Manager does, then plays it
 * on a real AnimationState through `play()`. This exercises the whole runtime
 * path rather than a hand built state.
 */
function createPlayedAnimation (config, frameCount, durations)
{
    var textureManager = createTextureManager(frameCount);
    var animationManager = createAnimationManager();

    animationManager.textureManager = textureManager;

    var anim = new Animation(animationManager, 'walk', Object.assign({}, config, {
        frames: durations.map(function (duration, i)
        {
            return { key: 'tex', frame: i, duration: duration };
        })
    }));

    var parent = {
        scene: { sys: { anims: animationManager } },
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

    var state = new AnimationState(parent);

    animationManager.get = function (key)
    {
        return (key === 'walk') ? anim : null;
    };

    parent.anims = state;

    state.play('walk');

    return { anim: anim, state: state };
}

function step (state, from, to, delta)
{
    for (var t = from; t < to; t += delta)
    {
        state.update(t, delta);
    }
}

// ---------------------------------------------------------------------------
// Animation#getFrameAtTime matching the recorded playback
// ---------------------------------------------------------------------------

describe('Animation#getFrameAtTime and real playback', function ()
{
    it('should match a one millisecond playback of the walk animation', function ()
    {
        var played = createPlayedAnimation({
            frameRate: 10,
            delay: 30,
            yoyo: true,
            repeat: 1,
            repeatDelay: 50
        }, 4, [ 80, 120, 40, 200 ]);

        for (var t = 0; t < 1500; t++)
        {
            played.state.update(t, 1);

            //  The frame asked for at 't + 1' is the one the update loop has just set
            if (t + 1 >= 30)
            {
                var frame = played.anim.getFrameAtTime(t + 1);

                expect(frame.textureFrame).toBe(played.state.currentFrame.textureFrame);
            }
        }
    });

    it('should match a one millisecond playback of the simple animation', function ()
    {
        var played = createPlayedAnimation({ frameRate: 5 }, 3, [ 80, 120, 40 ]);

        for (var t = 0; t < 400; t++)
        {
            played.state.update(t, 1);

            expect(played.anim.getFrameAtTime(t + 1).textureFrame).toBe(played.state.currentFrame.textureFrame);
        }
    });
});

// ---------------------------------------------------------------------------
// The scenarios from the spec, using the public API only
// ---------------------------------------------------------------------------

describe('animation playback timeline', function ()
{
    var walk;

    beforeEach(function ()
    {
        walk = createPlayedAnimation({
            frameRate: 10,
            delay: 30,
            yoyo: true,
            repeat: 1,
            repeatDelay: 50
        }, 4, [ 80, 120, 40, 200 ]);
    });

    it('should report no frame during the opening delay', function ()
    {
        expect(walk.anim.getFrameAtTime(29)).toBeNull();
    });

    it('should report frame 0 at 30 ms', function ()
    {
        expect(walk.anim.getFrameAtTime(30).textureFrame).toBe(0);
    });

    it('should report frame 0 at 839 ms and frame 1 at 840 ms', function ()
    {
        expect(walk.anim.getFrameAtTime(839).textureFrame).toBe(0);
        expect(walk.anim.getFrameAtTime(840).textureFrame).toBe(1);
    });

    it('should still be playing at 1439 ms and stopped at 1440 ms', function ()
    {
        step(walk.state, 0, 1439, 1);

        expect(walk.state.isPlaying).toBe(true);
        expect(walk.state.currentFrame.textureFrame).toBe(0);

        walk.state.update(1439, 1);

        expect(walk.state.isPlaying).toBe(false);
        expect(walk.state.currentFrame.textureFrame).toBe(0);
    });

    it('should show frame 0 and keep playing after a 5000 ms step, then stop 16 ms later', function ()
    {
        walk.state.update(0, 5000);

        expect(walk.state.currentFrame.textureFrame).toBe(0);
        expect(walk.state.isPlaying).toBe(true);

        walk.state.update(5000, 16);

        expect(walk.state.currentFrame.textureFrame).toBe(0);
        expect(walk.state.isPlaying).toBe(false);
    });

    it('should report frame 2 at 500 ms and frame 1 at 900 ms', function ()
    {
        expect(walk.anim.getFrameAtTime(500).textureFrame).toBe(2);
        expect(walk.anim.getFrameAtTime(900).textureFrame).toBe(1);
    });

    it('should report the resting frame 0 at 5000 ms', function ()
    {
        expect(walk.anim.getFrameAtTime(5000).textureFrame).toBe(0);
    });
});

describe('simple animation playback timeline', function ()
{
    var simple;

    beforeEach(function ()
    {
        simple = createPlayedAnimation({ frameRate: 5 }, 3, [ 80, 120, 40 ]);
    });

    it('should report frame 0 at 79 ms and frame 1 at 80 ms', function ()
    {
        expect(simple.anim.getFrameAtTime(79).textureFrame).toBe(0);
        expect(simple.anim.getFrameAtTime(80).textureFrame).toBe(1);
    });

    it('should report frame 1 at 199 ms and frame 2 at 200 ms', function ()
    {
        expect(simple.anim.getFrameAtTime(199).textureFrame).toBe(1);
        expect(simple.anim.getFrameAtTime(200).textureFrame).toBe(2);
    });

    it('should still be playing at 239 ms and stopped at 240 ms, on frame 2', function ()
    {
        step(simple.state, 0, 239, 1);

        expect(simple.state.isPlaying).toBe(true);
        expect(simple.state.currentFrame.textureFrame).toBe(2);

        simple.state.update(239, 1);

        expect(simple.state.isPlaying).toBe(false);
        expect(simple.state.currentFrame.textureFrame).toBe(2);
    });
});

describe('progress and time are different reads', function ()
{
    it('should return the frame closest to a progress value', function ()
    {
        var played = createPlayedAnimation({
            frameRate: 10,
            delay: 30,
            yoyo: true,
            repeat: 1,
            repeatDelay: 50
        }, 4, [ 80, 120, 40, 200 ]);

        expect(played.anim.getFrameByProgress(0).textureFrame).toBe(0);
        expect(played.anim.getFrameByProgress(0.5).textureFrame).toBe(2);
        expect(played.anim.getFrameByProgress(1).textureFrame).toBe(3);
    });

    it('should not treat progress as a time in milliseconds', function ()
    {
        var played = createPlayedAnimation({
            frameRate: 10,
            delay: 30,
            yoyo: true,
            repeat: 1,
            repeatDelay: 50
        }, 4, [ 80, 120, 40, 200 ]);

        //  At 500 ms the playhead is on frame 2, but by progress frame 2 is at 0.5
        expect(played.anim.getFrameAtTime(500).textureFrame).toBe(2);
        expect(played.anim.getFrameByProgress(0.5).textureFrame).toBe(2);

        //  The two reads diverge once the timeline is considered: by 900 ms the
        //  playhead is on frame 1, which progress places at 1/3, not at 0.9
        expect(played.anim.getFrameAtTime(900).textureFrame).toBe(1);
        expect(played.anim.getFrameByProgress(0.9).textureFrame).toBe(3);
    });
});
