const tracker = {
    // config options
    detectorModel: poseDetection.SupportedModels.MoveNet, // detector model
    detectorConfig: { // detector configuration
        modelType: poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
        enableSmoothing: true,
        multiPoseMaxDimension: 256,
        enableTracking: true,
        trackerType: poseDetection.TrackerType.BoundingBox
    },
    autofit: true, // bool, enable autofit on canvas scaling
    enableAI: true, // bool, enable or disable tracking
    enableVideo: true, // bool, enable or disable display original video on canvas on canvas
    enable3D: false,
    photoCaptured: false, // bool, enable or disable 3D keypoints
    pointWidth: 6, // width of line between points
    pointRadius: 8, // point circle radius
    minScore: 0.35, // minimum threshold for estimated point
    log: true,
    warningMessage: '',

    captureScoreThreshold: 0.95, // bool, enable logging to console
    hooks: { // user defined hooks/events
        'beforeupdate': [], // before poses update
        'afterupdate': [], // after poses update
        'statuschange': [], // when status change
        'detectorerror': [], // if detector error 
        'videoerror': [] // if video error
    },

    // HTML elements
    el3D: '#view_3d', // HTML element for 3D keypoint
    elCanvas: '#canvas', // HTML element for canvas
    elVideo: '#video', // HTML element for video
    
    // internals
    detector: null, // tensor flow detector instance
    reqID: null, // requested frame ID
    isPlaying: false, // bool, current playback state
    isWaiting: false, // bool, waiting for video state
    poses: null, // estimated poses
    video: null, // DOMElement with vidoe
    canvas: null, // DOMElement with canvas 
    ctx: null, // canvas context instance
    container: null, // container for video
    status: '', // current status message
    anchors3D: [ // 3D keypoints anchors
        [0, 0, 0],
        [0, 1, 0],
        [-1, 0, 0],
        [-1, -1, 0]
    ],
    scatterGL: null, // ScatterGL instance
    scatterGLEl: null, // DOMElement with ScatterGL container
    scatterGLInitialized: false, // bool, ScatterGL initialization state
    videoJS: null, // videoJS instance 
    paths: {
        'blaze_pose': {
            // left hip > left knee
            'nose_to_left_toe': {
                'from_x': ['nose'],
                'from_y': ['nose'],
                'to_x': ['left_foot_index'], // or 'right_foot_index'
                'to_y': ['left_foot_index'],
                'scores': ['nose', 'left_foot_index'],
                'rgb': [255, 0, 0] // Red line
            }
        }
    },

    /*
        Run predictions
     */
    run: function(source) {
        switch (source) {
            case 'video':
                tracker.initVideo();
                break;
            case 'camera':
                tracker.initCamera();
                break;
            case 'stream':
                tracker.initStream();
                break;
        }
    },


    /*
        Initialize core elements
     */
    init: function() {
        tracker.log('Initializing...');

        // init elements
        tracker.video = document.querySelector(tracker.elVideo);
        tracker.canvas = document.querySelector(tracker.elCanvas),
        tracker.scatterGLEl = document.querySelector(tracker.el3D);
        tracker.ctx = tracker.canvas.getContext("2d");

        // instantiate ScatterGL for 3D points view (BlazePose model only
    },

    /*
        Initialize camera
     */
    initCamera: async function() {
        tracker.init();

        // init detectot
        tracker.detector = await poseDetection.createDetector(
            tracker.detectorModel,
            tracker.detectorConfig
        );

        // init camera
        try {
            tracker.video = await tracker.setupCamera();
            tracker.video.play();
            tracker.cameraFrame();
        } catch (e) {
            tracker.dispatch('videoerror', e);
            console.error(e);
        }
    },

    capturePhoto: function () {
        const dataURL = tracker.canvas.toDataURL("image/png");
        
        // Option 1: Open in a new tab
        // window.open(dataURL);
    
        // Option 2: Automatically download
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'pose_capture.png';
        a.click();
    
        // Option 3: Trigger a custom event
        // tracker.dispatch('photocaptured', dataURL);
    },
    


    /*
        Set-up camera
     */
    setupCamera: async function() {
        tracker.setStatus('Please wait...initializing camera...');
        // init device
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error(
                "Browser API navigator.mediaDevices.getUserMedia not available"
            );
        }

        tracker.isMirrored = false;

        const constraints = {
            audio: false,
            video: {
                facingMode: "user", // or "environment"
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (constraints.video.facingMode === "user") {
            tracker.isMirrored = true;
            }
            tracker.video.srcObject = stream; // attach camera stream to video

            // get width and height of the camera video stream
            let stream_settings = stream.getVideoTracks()[0].getSettings();
            let stream_width = stream_settings.width;
            let stream_height = stream_settings.height;

            // re-init width and height with info from stream
            tracker.video.width = stream_width;
            tracker.video.height = stream_height;

            return new Promise((resolve) => {
                tracker.video.onloadedmetadata = () => {
                    console.log("ðŸ“¸ Video Metadata Loaded");
                    console.log("âœ… videoWidth:", tracker.video.videoWidth);
                    console.log("âœ… videoHeight:", tracker.video.videoHeight);
                
                    resolve(tracker.video);
                }; // âœ… fixed
            });
    },

    scaleKeypoints: function(keypoints, videoSize, canvasSize, offsetX = 0, mirror = false) {

        
        const scaleX = canvasSize.width / videoSize.width;
        const scaleY = canvasSize.height / videoSize.height;
      
        return keypoints.map(kp => ({
          ...kp,
          x: mirror
            ? canvasSize.width - (kp.x * scaleX) + offsetX
            : (kp.x * scaleX) + offsetX,
          y: kp.y * scaleY,
        }));
    },
      

    /*
        Render camera frame
     */
        cameraFrame: async function () {
            tracker.setStatus('');
        
            // Predict poses
            tracker.poses = await tracker.detector.estimatePoses(tracker.video);
        
            const dpr = window.devicePixelRatio || 1;
            tracker.canvas.width = tracker.canvas.clientWidth * dpr;
            tracker.canvas.height = tracker.canvas.clientHeight * dpr;
        
            const ctx = tracker.ctx;
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            ctx.scale(dpr, dpr); // Scale for high-DPI
        
            if (tracker.video.readyState === tracker.video.HAVE_ENOUGH_DATA) {
                let videoWidth = tracker.video.videoWidth;
                let videoHeight = tracker.video.videoHeight;
        
                const isPortrait = window.innerHeight > window.innerWidth;
                if (isPortrait && videoWidth > videoHeight) {
                    const temp = videoWidth;
                    videoWidth = videoHeight;
                    videoHeight = temp;
                }
        
                const videoSize = { width: videoWidth, height: videoHeight };
                const canvasSize = {
                    width: tracker.canvas.clientWidth,
                    height: tracker.canvas.clientHeight
                };
        
                const renderSize = tracker.calculateSize(videoSize, canvasSize);
                const xOffset = (canvasSize.width - renderSize.width) / 2;
                const yOffset = (canvasSize.height - renderSize.height) / 2;
        
                tracker.clearCanvas();
        
                // ðŸªž Mirror canvas horizontally if front camera
                if (tracker.isMirrored) {
                    ctx.save();
                    ctx.translate(canvasSize.width, 0);
                    ctx.scale(-1, 1); // Flip horizontally
                    ctx.drawImage(tracker.video, xOffset, yOffset, renderSize.width, renderSize.height);
                    ctx.restore();
                } else {
                    ctx.drawImage(tracker.video, xOffset, yOffset, renderSize.width, renderSize.height);
                }
        
                // Store render state for scaling
                tracker._xOffset = xOffset;
                tracker._yOffset = yOffset;
                tracker._renderSize = renderSize;
                tracker._videoSize = videoSize;
                tracker._canvasSize = canvasSize;
            }
        
            if (tracker.enableAI) {
                tracker.handlePoses();
            }
        
            tracker.reqID = window.requestAnimationFrame(tracker.cameraFrame);
        },
        
 
    findKeypoint: function(name, pose) {
        for (const keypoint of pose.keypoints) {
            if (keypoint.name == name) {
                return keypoint;
            }
        }
    },

    /*
        Find and return pose keypoint coordinate (X or Y) by keypoint's name
     */
    findPosePoint: function(axis, name, pose) {
        const kp = tracker.findKeypoint(name, pose);
        return kp[axis];
    },

    /*
        Return coordinate (X or Y) for points in path
     */
    getCoord: function(axis, points, pose) {
        // if only one point then return coordinate for this one
        if (points.length == 1) {
            return tracker.findPosePoint(axis, points[0], pose);
        } else {
            // if multiple points then calculate coordinate between them
            let sum = 0.0;
            for (const el of points) {
                sum += tracker.findPosePoint(axis, el, pose);
            }
            return sum / points.length;
        }
    },

    /*
        Return coordinates for path
     */
    getCoords: function(path, pose) {
        return {
            'from_x': tracker.getCoord('x', path.from_x, pose),
            'from_y': tracker.getCoord('y', path.from_y, pose),
            'to_x': tracker.getCoord('x', path.to_x, pose),
            'to_y': tracker.getCoord('y', path.to_y, pose),
        };
    },

    /*
        Get score for path
     */
    getScore: function(path, pose) {
        // if only one point then check score for this one
        if (path.scores.length == 1) {
            return tracker.findKeypoint(path.scores[0], pose).score;
        } else {
            // if multiple points then check score for all
            let sum = 0.0;
            for (const el of path.scores) {
                sum += tracker.findKeypoint(el, pose).score;
            }
            return sum / path.scores.length;
        }
    },

    /*
        Checks if path has required minimum score do draw it on canvas
     */
    hasScore: function(path, pose) {
        let res = true;
        // if only one point then check score for this one
        if (path.scores.length == 1) {
            if (tracker.findKeypoint(path.scores[0], pose).score < tracker.minScore) {
                res = false;
            }
        } else {
            // if multiple points then check score for all
            for (const el of path.scores) {
                if (tracker.findKeypoint(el, pose).score < tracker.minScore) {
                    res = false;
                    break;
                }
            }
        }
        return res;
    },

    calculateSize: function(srcSize, dstSize) {
        const srcRatio = srcSize.width / srcSize.height;
        const dstRatio = dstSize.width / dstSize.height;
        if (dstRatio > srcRatio) {
            return {
                width: dstSize.height * srcRatio,
                height: dstSize.height
            };
        } else {
            return {
                width: dstSize.width,
                height: dstSize.width / srcRatio
            };
        }
    },

    /*
        Re-calculate/scale X position of point
     */
        scaleX: function (x) {
            const factor = tracker._renderSize.width / tracker._videoSize.width;
            if (tracker.isMirrored) {
                return Math.ceil((tracker._renderSize.width - x * factor) + tracker._xOffset);
            }
            return Math.ceil(x * factor + tracker._xOffset);
        },

    /*
        Re-calculate/scale Y position of point
     */
        scaleY: function (y) {
            const factor = tracker._renderSize.height / tracker._videoSize.height;
            return Math.ceil(y * factor + tracker._yOffset);
        },

    /*
        Handle poses and draw them on canvas
     */
        handlePoses: function() {
            // run user defined hooks
            tracker.dispatch('beforeupdate', tracker.poses);
        
            if (tracker.poses && tracker.poses.length > 0) {
                let pathlist;
        
                // get correct pathlist for specified neural net
                switch (tracker.detectorModel) {
                    case poseDetection.SupportedModels.BlazePose:
                        pathlist = tracker.paths['blaze_pose'];
                        break;
                }
        
                let point, score;
        
                for (let pose of tracker.poses) {
                    for (let k in pathlist) {
                        if (!pathlist.hasOwnProperty(k)) continue;
                        if (!tracker.hasScore(pathlist[k], pose)) continue;
        
                        point = tracker.getCoords(pathlist[k], pose);
                        score = tracker.getScore(pathlist[k], pose);
        
                        // Draw path on canvas
                        tracker.drawPath(
                            point.from_x, point.from_y,
                            point.to_x, point.to_y,
                            pathlist[k].rgb[0],
                            pathlist[k].rgb[1],
                            pathlist[k].rgb[2],
                            score
                        );
        
                        // 🔴 Only capture when "nose_to_left_toe" is drawn & not already captured
                        if (k === "nose_to_left_toe" && !tracker.photoCaptured) {
                            const nose = tracker.findKeypoint("nose", pose);
                            const toe = tracker.findKeypoint("left_foot_index", pose);
                        
                            const noseScore = nose?.score || 0;
                            const toeScore = toe?.score || 0;
                        
                            if (noseScore >= tracker.captureScoreThreshold && toeScore >= tracker.captureScoreThreshold) {
                                console.log("threshold", tracker.captureScoreThreshold, "nose", noseScore, "toe", toeScore);
                                tracker.warningMessage = '';
                                if (!tracker.photoCaptured) {
                                    tracker.capturePhoto();
                                    tracker.photoCaptured = true;
                                    setTimeout(() => { tracker.photoCaptured = false; }, 5000);
                                }
                            } else {
                                // Show warning if scores are too low
                                tracker.warningMessage = '⚠️ Please make sure your nose and toes are visible';
                            }
                        }
                    }
        
                    // draw 3D points if available using ScatterGL
                    if (tracker.enable3D && pose.keypoints3D && pose.keypoints3D.length > 0) {
                        tracker.drawKeypoints3D(pose.keypoints3D);
                    }

                    if (tracker.warningMessage) {
                        tracker.ctx.save();
                        tracker.ctx.font = '24px Arial';
                        tracker.ctx.fillStyle = 'red';
                        tracker.ctx.fillText(tracker.warningMessage, 20, 40);
                        tracker.ctx.restore();
                    }
                }
            }
        
            // run user defined hooks
            tracker.dispatch('afterupdate', tracker.poses);
        },
        

    /*
        Draw point and bone on canvas
     */
    drawPath: function(fromX, fromY, toX, toY, r, g, b, score) {
        // use score to calculate alpha
        let a = score - 0.15;
        if (a < 0) {
            a = 0.0;
        }
        // draw connection
        tracker.drawLine(tracker.scaleX(fromX), tracker.scaleY(fromY), 
            tracker.scaleX(toX), tracker.scaleY(toY), 
            r, g, b, a);

        // draw joint
        tracker.drawCircle(tracker.scaleX(fromX), tracker.scaleY(fromY), 
            r, g, b, a);
    },

    /*
        Draw connection between points on canvas
     */
    drawLine: function(fromX, fromY, toX, toY, r, g, b, a) {
        tracker.ctx.beginPath();
        tracker.ctx.lineWidth = tracker.pointWidth;
        tracker.ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        tracker.ctx.moveTo(fromX, fromY);
        tracker.ctx.lineTo(toX, toY);
        tracker.ctx.stroke();
        tracker.ctx.closePath();
    },

    /*
        Draw point on canvas
     */
    drawCircle: function(fromX, fromY, r, g, b, a) {
        tracker.ctx.beginPath();
        tracker.ctx.arc(fromX, fromY, tracker.pointRadius, 0, 2 * Math.PI);
        tracker.ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        tracker.ctx.fill();
        tracker.ctx.closePath();
    },


    clearCanvas: function() {
        tracker.ctx.save();
        tracker.ctx.setTransform(1, 0, 0, 1, 0, 0);
        tracker.ctx.clearRect(0, 0, tracker.canvas.width, tracker.canvas.height);
        tracker.ctx.restore();
    },

    /*
        Display play/pause icon
     */
    showPlaybackControls: function() {
        let size = (tracker.canvas.height / 2) * 0.5;

        tracker.ctx.fillStyle = "black";
        tracker.ctx.globalAlpha = 0.5;
        tracker.ctx.fillRect(0, 0, tracker.canvas.width, tracker.canvas.height);
        tracker.ctx.fillStyle = "#DDD";
        tracker.ctx.globalAlpha = 0.75;
        tracker.ctx.beginPath();
        tracker.ctx.moveTo(tracker.canvas.width / 2 + size / 2, tracker.canvas.height / 2);
        tracker.ctx.lineTo(tracker.canvas.width / 2 - size / 2, tracker.canvas.height / 2 + size);
        tracker.ctx.lineTo(tracker.canvas.width / 2 - size / 2, tracker.canvas.height / 2 - size);
        tracker.ctx.closePath();
        tracker.ctx.fill();
        tracker.ctx.globalAlpha = 1;
    },

    /*
        Handle play/pause click on video
     */
    playPauseClick: function() {
        if (tracker.container !== undefined && tracker.container.ready) {
            if (tracker.container.video.paused) {
                tracker.log('click: Play');
                tracker.play();
                tracker.isWaiting = true;
                tracker.setStatus('Please wait...');
            } else {
                // abort if waiting for playing
                if (!tracker.isWaiting) {
                    tracker.log('click: Pause');
                    tracker.pause();
                    tracker.setStatus('Paused.');
                }
            }
        }
    },

    /*
        Play video
     */
    play: function() {
        tracker.container.video.play();
    },

    /*
        Pause video
     */
    pause: function() {
        tracker.container.video.pause();
    },

    /*
        Log message
     */
    log: function(...args) {
        if (tracker.log) {
            console.log(...args);
        }
    },

    /*
        Set status message
     */
    setStatus: function(msg) {
        tracker.status = msg;
        tracker.dispatch('statuschange', tracker.status);
    },

    /*
        Append external hook/event
     */
    on: function(name, hook) {
        if (typeof tracker.hooks[name] === 'undefined') {
            return;
        }
        tracker.hooks[name].push(hook);
    },

    /*
        Dispatch hook/event
     */
    dispatch: function(name, event) {
        if (typeof tracker.hooks[name] === 'undefined') {
            return;
        }
        for (const hook of tracker.hooks[name]) {
            hook(event);
        }
    },

    /*
        Pre-initialize model by name
     */
    setModel: function(model) {
        switch (model) {
            case 'BlazePoseLite':
                tracker.detectorModel = poseDetection.SupportedModels.BlazePose;
                tracker.detectorConfig = {
                    runtime: 'tfjs',
                    enableSmoothing: true,
                    modelType: 'lite'
                };
                tracker.minScore = 0.65;
                break;


        }
    },
}
