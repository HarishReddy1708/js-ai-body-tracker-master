const tracker = {
    // config options
    detectorModel: poseDetection.SupportedModels.BlazePose, // detector model
    detectorConfig: { // detector configuration
        modelType: poseDetection.movenet.modelType.lite,
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
                'to_x': ['left_foot_index'], 
                'to_y': ['left_foot_index'],
                'scores': ['nose', 'left_foot_index'],
                'rgb': [255, 0, 0]
            },
            'l_hip_l_knee': {
                'from_x': ['left_hip'],
                'from_y': ['left_hip'],
                'to_x': ['left_knee'],
                'to_y': ['left_knee'],
                'scores': ['left_knee'],
                'rgb': [42, 163, 69]
            },
            // right hip > right knee
            'r_hip_r_knee': {
                'from_x': ['right_hip'],
                'from_y': ['right_hip'],
                'to_x': ['right_knee'],
                'to_y': ['right_knee'],
                'scores': ['right_knee'],
                'rgb': [42, 163, 69]
            },
            // hips (mid-point)
            'hip_l_m': { // left
                'from_x': ['left_hip'],
                'from_y': ['left_hip'],
                'to_x': ['left_hip', 'right_hip'],
                'to_y': ['left_hip', 'right_hip'],
                'scores': ['left_hip', 'right_hip'],
                'rgb': [140, 232, 90]
            },
            'hip_r_m': { // right
                'from_x': ['right_hip'],
                'from_y': ['right_hip'],
                'to_x': ['left_hip', 'right_hip'],
                'to_y': ['left_hip', 'right_hip'],
                'scores': ['left_hip', 'right_hip'],
                'rgb': [140, 232, 90]
            },
            // hip to shoulders
            'hip_l_shoulder_l': { // left
                'from_x': ['left_hip'],
                'from_y': ['left_hip'],
                'to_x': ['left_shoulder'],
                'to_y': ['left_shoulder'],
                'scores': ['left_hip', 'left_shoulder'],
                'rgb': [242, 85, 240]
            },
            'hip_r_shoulder_r': { // right
                'from_x': ['right_hip'],
                'from_y': ['right_hip'],
                'to_x': ['right_shoulder'],
                'to_y': ['right_shoulder'],
                'scores': ['right_hip', 'right_shoulder'],
                'rgb': [242, 85, 240]
            },
            // left knee > left ankle
            'l_knee_l_ankle': {
                'from_x': ['left_knee'],
                'from_y': ['left_knee'],
                'to_x': ['left_ankle'],
                'to_y': ['left_ankle'],
                'scores': ['left_ankle'],
                'rgb': [140, 232, 90]
            },
            // right knee > right ankle
            'r_knee_r_ankle': {
                'from_x': ['right_knee'],
                'from_y': ['right_knee'],
                'to_x': ['right_ankle'],
                'to_y': ['right_ankle'],
                'scores': ['right_ankle'],
                'rgb': [140, 232, 90]
            },
            // left ankle > left heel
            'l_ankle_l_heel': {
                'from_x': ['left_ankle'],
                'from_y': ['left_ankle'],
                'to_x': ['left_heel'],
                'to_y': ['left_heel'],
                'scores': ['left_ankle', 'left_heel'],
                'rgb': [42, 163, 69]
            },
            // left heel > left foot_index
            'l_heel_l_foot_index': {
                'from_x': ['left_heel'],
                'from_y': ['left_heel'],
                'to_x': ['left_foot_index'],
                'to_y': ['left_foot_index'],
                'scores': ['left_heel', 'left_foot_index'],
                'rgb': [42, 163, 69]
            },
            // left foot_index > left ankle
            'l_foot_index_l_ankle': {
                'from_x': ['left_foot_index'],
                'from_y': ['left_foot_index'],
                'to_x': ['left_ankle'],
                'to_y': ['left_ankle'],
                'scores': ['left_foot_index', 'left_ankle'],
                'rgb': [42, 163, 69]
            },
            // right ankle > right heel
            'r_ankle_r_heel': {
                'from_x': ['right_ankle'],
                'from_y': ['right_ankle'],
                'to_x': ['right_heel'],
                'to_y': ['right_heel'],
                'scores': ['right_ankle', 'right_heel'],
                'rgb': [42, 163, 69]
            },
            // right heel > right foot_index
            'r_heel_r_foot_index': {
                'from_x': ['right_heel'],
                'from_y': ['right_heel'],
                'to_x': ['right_foot_index'],
                'to_y': ['right_foot_index'],
                'scores': ['right_heel', 'right_foot_index'],
                'rgb': [42, 163, 69]
            },
            // right foot_index > right ankle
            'r_foot_index_r_ankle': {
                'from_x': ['right_foot_index'],
                'from_y': ['right_foot_index'],
                'to_x': ['right_ankle'],
                'to_y': ['right_ankle'],
                'scores': ['right_foot_index', 'right_ankle'],
                'rgb': [42, 163, 69]
            },
            // hips > shoulders
            'hips_shoulders_m': {
                'from_x': ['left_hip', 'right_hip'],
                'from_y': ['left_hip', 'right_hip'],
                'to_x': ['left_shoulder', 'right_shoulder'],
                'to_y': ['left_shoulder', 'right_shoulder'],
                'scores': ['left_hip', 'right_hip'],
                'rgb': [242, 85, 240]
            },
            // shoulders (mid-point)
            'shoulder_l_m': { // left
                'from_x': ['left_shoulder'],
                'from_y': ['left_shoulder'],
                'to_x': ['left_shoulder', 'right_shoulder'],
                'to_y': ['left_shoulder', 'right_shoulder'],
                'scores': ['left_shoulder', 'right_shoulder'],
                'rgb': [92, 70, 235]
            },
            'shoulder_r_m': { // right
                'from_x': ['right_shoulder'],
                'from_y': ['right_shoulder'],
                'to_x': ['left_shoulder', 'right_shoulder'],
                'to_y': ['left_shoulder', 'right_shoulder'],
                'scores': ['left_shoulder', 'right_shoulder'],
                'rgb': [92, 70, 235]
            },
            // shoulders (mid-point) > nose (neck)
            'neck': {
                'from_x': ['left_shoulder', 'right_shoulder'],
                'from_y': ['left_shoulder', 'right_shoulder'],
                'to_x': ['left_ear', 'right_ear'],
                'to_y': ['left_ear', 'right_ear'],
                'scores': ['left_shoulder', 'right_shoulder'],
                'rgb': [92, 108, 145]
            },
            // left shoulder > left elbow
            'l_shoulder_l_elbow': {
                'from_x': ['left_shoulder'],
                'from_y': ['left_shoulder'],
                'to_x': ['left_elbow'],
                'to_y': ['left_elbow'],
                'scores': ['left_elbow'],
                'rgb': [245, 129, 66]
            },
            // right shoulder > right elbow
            'r_shoulder_r_elbow': {
                'from_x': ['right_shoulder'],
                'from_y': ['right_shoulder'],
                'to_x': ['right_elbow'],
                'to_y': ['right_elbow'],
                'scores': ['right_elbow'],
                'rgb': [245, 129, 66]
            },
            // left elbow > left wrist
            'l_elbow_l_wrist': {
                'from_x': ['left_elbow'],
                'from_y': ['left_elbow'],
                'to_x': ['left_wrist'],
                'to_y': ['left_wrist'],
                'scores': ['left_wrist'],
                'rgb': [227, 156, 118]
            },
            // right elbow > right wrist
            'r_elbow_r_wrist': {
                'from_x': ['right_elbow'],
                'from_y': ['right_elbow'],
                'to_x': ['right_wrist'],
                'to_y': ['right_wrist'],
                'scores': ['right_wrist'],
                'rgb': [227, 156, 118]
            },

            // left wrist > left_thumb
            'l_wrist_l_thumb': {
                'from_x': ['left_wrist'],
                'from_y': ['left_wrist'],
                'to_x': ['left_thumb'],
                'to_y': ['left_thumb'],
                'scores': ['left_wrist', 'left_thumb'],
                'rgb': [245, 129, 66]
            },
            // left wrist > left_pinky
            'l_wrist_l_pinky': {
                'from_x': ['left_wrist'],
                'from_y': ['left_wrist'],
                'to_x': ['left_pinky'],
                'to_y': ['left_pinky'],
                'scores': ['left_wrist', 'left_pinky'],
                'rgb': [245, 129, 66]
            },
            // left pinky > left index
            'l_pinky_l_index': {
                'from_x': ['left_pinky'],
                'from_y': ['left_pinky'],
                'to_x': ['left_index'],
                'to_y': ['left_index'],
                'scores': ['left_pinky', 'left_index'],
                'rgb': [245, 129, 66]
            },
            // left index > left wrist
            'l_index_l_wrist': {
                'from_x': ['left_index'],
                'from_y': ['left_index'],
                'to_x': ['left_wrist'],
                'to_y': ['left_wrist'],
                'scores': ['left_index', 'left_wrist'],
                'rgb': [245, 129, 66]
            },
            // right wrist > right_thumb
            'r_wrist_r_thumb': {
                'from_x': ['right_wrist'],
                'from_y': ['right_wrist'],
                'to_x': ['right_thumb'],
                'to_y': ['right_thumb'],
                'scores': ['right_wrist', 'right_thumb'],
                'rgb': [245, 129, 66]
            },
            // right wrist > right_pinky
            'r_wrist_r_pinky': {
                'from_x': ['right_wrist'],
                'from_y': ['right_wrist'],
                'to_x': ['right_pinky'],
                'to_y': ['right_pinky'],
                'scores': ['right_wrist', 'right_pinky'],
                'rgb': [245, 129, 66]
            },
            // right pinky > right index
            'r_pinky_r_index': {
                'from_x': ['right_pinky'],
                'from_y': ['right_pinky'],
                'to_x': ['right_index'],
                'to_y': ['right_index'],
                'scores': ['right_pinky', 'right_index'],
                'rgb': [245, 129, 66]
            },
            // right index > right wrist
            'r_index_r_wrist': {
                'from_x': ['right_index'],
                'from_y': ['right_index'],
                'to_x': ['right_wrist'],
                'to_y': ['right_wrist'],
                'scores': ['right_index', 'right_wrist'],
                'rgb': [245, 129, 66]
            },
            // nose > left eye_inner
            'nose_l_eye_inner': {
                'from_x': ['nose'],
                'from_y': ['nose'],
                'to_x': ['left_eye_inner'],
                'to_y': ['left_eye_inner'],
                'scores': ['left_eye_inner'],
                'rgb': [255, 0, 0]
            },

            // nose > right eye_inner
            'nose_r_eye_inner': {
                'from_x': ['nose'],
                'from_y': ['nose'],
                'to_x': ['right_eye_inner'],
                'to_y': ['right_eye_inner'],
                'scores': ['right_eye_inner'],
                'rgb': [255, 0, 0]
            },
            // mouth_left > mouth_right
            'l_mouth_r_mouth': {
                'from_x': ['mouth_left'],
                'from_y': ['mouth_left'],
                'to_x': ['mouth_right'],
                'to_y': ['mouth_right'],
                'scores': ['mouth_left', 'mouth_right'],
                'rgb': [150, 0, 0]
            },
            // mouth_right > mouth_left
            'r_mouth_l_mouth': {
                'from_x': ['mouth_right'],
                'from_y': ['mouth_right'],
                'to_x': ['mouth_left'],
                'to_y': ['mouth_left'],
                'scores': ['mouth_right', 'mouth_left'],
                'rgb': [150, 0, 0]
            },

            // left eye > left eye_outer
            'l_eye_l_eye_outer': {
                'from_x': ['left_eye'],
                'from_y': ['left_eye'],
                'to_x': ['left_eye_outer'],
                'to_y': ['left_eye_outer'],
                'scores': ['left_eye_outer'],
                'rgb': [197, 117, 15]
            },
            // left eye_outer > left ear
            'l_eye_outer_l_ear': {
                'from_x': ['left_eye_outer'],
                'from_y': ['left_eye_outer'],
                'to_x': ['left_ear'],
                'to_y': ['left_ear'],
                'scores': ['left_ear'],
                'rgb': [197, 117, 15]
            },
            // left eye_inner > left eye
            'l_eye_inner_l_eye': {
                'from_x': ['left_eye_inner'],
                'from_y': ['left_eye_inner'],
                'to_x': ['left_eye'],
                'to_y': ['left_eye'],
                'scores': ['left_eye'],
                'rgb': [197, 217, 15]
            },
            // right eye > right eye_outer
            'r_eye_r_eye_outer': {
                'from_x': ['right_eye'],
                'from_y': ['right_eye'],
                'to_x': ['right_eye_outer'],
                'to_y': ['right_eye_outer'],
                'scores': ['right_eye_outer'],
                'rgb': [197, 117, 15]
            },
            // right eye_outer > right ear
            'r_eye_outer_r_ear': {
                'from_x': ['right_eye_outer'],
                'from_y': ['right_eye_outer'],
                'to_x': ['right_ear'],
                'to_y': ['right_ear'],
                'scores': ['right_ear'],
                'rgb': [197, 117, 15]
            },
            // right eye_inner > right eye
            'r_eye_inner_r_eye': {
                'from_x': ['right_eye_inner'],
                'from_y': ['right_eye_inner'],
                'to_x': ['right_eye'],
                'to_y': ['right_eye'],
                'scores': ['right_eye'],
                'rgb': [197, 217, 15]
            }
        }
    },

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


    init: function() {
        tracker.log('Initializing...');
        tracker.video = document.querySelector(tracker.elVideo);
        tracker.canvas = document.querySelector(tracker.elCanvas),
        tracker.scatterGLEl = document.querySelector(tracker.el3D);
        tracker.ctx = tracker.canvas.getContext("2d");

    },


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
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = 'pose_capture.png';
        a.click();
    
    },
    

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
                width: { ideal: 256 },
                height: { ideal: 256 },
            },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (constraints.video.facingMode === "user") {
            tracker.isMirrored = true;
            }
            tracker.video.srcObject = stream; // attach camera stream to video

            let stream_settings = stream.getVideoTracks()[0].getSettings();
            let stream_width = stream_settings.width;
            let stream_height = stream_settings.height;

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

    drawCenterBox: function (widthRatio = 0.5, heightRatio = 0.6, color = 'red') {
        const ctx = tracker.ctx;
        const dpr = window.devicePixelRatio || 1;
    
        const cssWidth = tracker.canvas.clientWidth;
        const cssHeight = tracker.canvas.clientHeight;
    
        const boxWidth = cssWidth * widthRatio;
        const boxHeight = cssHeight * heightRatio;
    
        const x = ((cssWidth - boxWidth) / 2) * dpr;
        const y = ((cssHeight - boxHeight) / 2) * dpr;
        const w = boxWidth * dpr;
        const h = boxHeight * dpr;
    
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    
        return { x, y, w, h }; // Return box bounds
    },

    isPointInsideBox: function (x, y, box) {
        return (
            x >= box.x &&
            x <= box.x + box.w &&
            y >= box.y &&
            y <= box.y + box.h
        );
    },
    
    
    
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
                ;
        
                if (tracker.isMirrored) {
                    ctx.save();
                    ctx.translate(canvasSize.width, 0);
                    ctx.scale(-1, 1); // Flip horizontally
                    ctx.drawImage(tracker.video, xOffset, yOffset, renderSize.width, renderSize.height);
                    ctx.restore();
                } else {
                    ctx.drawImage(tracker.video, xOffset, yOffset, renderSize.width, renderSize.height);
                }
                console.log('🎯 Drawing center box...');

                //tracker.drawCenterBox(0.6, 0.9);

        
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

 
    findPosePoint: function(axis, name, pose) {
        const kp = tracker.findKeypoint(name, pose);
        return kp[axis];
    },

    getCoord: function(axis, points, pose) {
        if (points.length == 1) {
            return tracker.findPosePoint(axis, points[0], pose);
        } else {
            let sum = 0.0;
            for (const el of points) {
                sum += tracker.findPosePoint(axis, el, pose);
            }
            return sum / points.length;
        }
    },

    getCoords: function(path, pose) {
        return {
            'from_x': tracker.getCoord('x', path.from_x, pose),
            'from_y': tracker.getCoord('y', path.from_y, pose),
            'to_x': tracker.getCoord('x', path.to_x, pose),
            'to_y': tracker.getCoord('y', path.to_y, pose),
        };
    },


    getScore: function(path, pose) {
        if (path.scores.length == 1) {
            return tracker.findKeypoint(path.scores[0], pose).score;
        } else {
            let sum = 0.0;
            for (const el of path.scores) {
                sum += tracker.findKeypoint(el, pose).score;
            }
            return sum / path.scores.length;
        }
    },

    hasScore: function(path, pose) {
        let res = true;
        if (path.scores.length == 1) {
            if (tracker.findKeypoint(path.scores[0], pose).score < tracker.minScore) {
                res = false;
            }
        } else {
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

        scaleX: function (x) {
            const factor = tracker._renderSize.width / tracker._videoSize.width;
            if (tracker.isMirrored) {
                return Math.ceil((tracker._renderSize.width - x * factor) + tracker._xOffset);
            }
            return Math.ceil(x * factor + tracker._xOffset);
        },

 
        scaleY: function (y) {
            const factor = tracker._renderSize.height / tracker._videoSize.height;
            return Math.ceil(y * factor + tracker._yOffset);
        },


        handlePoses: function() {
            tracker.dispatch('beforeupdate', tracker.poses);
        
            const canvas = tracker.canvas;
            
        
            // Draw and get the centered box with dynamic size based on canvas dimensions (scaled as a fraction)
            const box = tracker.drawCenterBox(0.5, 0.8);  // box is 50% of the width and 60% of the height of the canvas
        
            // Loop through poses to check if nose and toe are inside the box
            if (tracker.poses && tracker.poses.length > 0) {
                let pathlist;
        
                // Choose pose model (BlazePose in this case)
                switch (tracker.detectorModel) {
                    case poseDetection.SupportedModels.BlazePose:
                        pathlist = tracker.paths['blaze_pose'];
                        break;
                }
        
                let point, score;
        
                // Loop through each pose and its keypoints
                for (let pose of tracker.poses) {
                    for (let k in pathlist) {
                        if (!pathlist.hasOwnProperty(k)) continue;
                        if (!tracker.hasScore(pathlist[k], pose)) continue;
        
                        point = tracker.getCoords(pathlist[k], pose);
                        score = tracker.getScore(pathlist[k], pose);
        
                        // Draw path
                        tracker.drawPath(
                            point.from_x, point.from_y,
                            point.to_x, point.to_y,
                            pathlist[k].rgb[0],
                            pathlist[k].rgb[1],
                            pathlist[k].rgb[2],
                            score
                        );
        
                        // Look for nose-to-toe path
                        if (k === "nose_to_left_toe" && !tracker.photoCaptured) {
                            const nose = tracker.findKeypoint("nose", pose);
                            const toe = tracker.findKeypoint("left_foot_index", pose);
        
                            const noseScore = nose?.score || 0;
                            const toeScore = toe?.score || 0;
        
                            // Check if nose and toe are visible (scores above threshold)
                            const noseVisible = noseScore >= tracker.captureScoreThreshold;
                            const toeVisible = toeScore >= tracker.captureScoreThreshold;
        
                            if (noseVisible && toeVisible) {
                                // Scale positions for canvas
                                const noseX = tracker.scaleX(nose.x);
                                const noseY = tracker.scaleY(nose.y);
                                const toeX = tracker.scaleX(toe.x);
                                const toeY = tracker.scaleY(toe.y);
        
                                // Check if both points are inside the box
                                const isNoseInside = tracker.isPointInsideBox(noseX, noseY, box);
                                const isToeInside = tracker.isPointInsideBox(toeX, toeY, box);
        
                                if (isNoseInside && isToeInside) {
                                    tracker.warningMessage = '';  // Clear warning if both points are inside the box
        
                                    // Capture photo if not already captured
                                    if (!tracker.photoCaptured) {
                                        tracker.capturePhoto();
                                        tracker.photoCaptured = true;
        
                                        // Reset capture flag after 5 seconds
                                        setTimeout(() => {
                                            tracker.photoCaptured = false;
                                        }, 5000);
                                    }
                                } else {
                                    // Warning if nose or toe are not inside the box
                                    tracker.warningMessage = '⚠️ Stand inside the red box!';
                                }
                            } else {
                                // Warning if nose or toe are not visible
                                tracker.warningMessage = '⚠️ Make sure your nose and toe are visible!';
                            }
                        }
                    }
        
                    // Draw 3D keypoints if enabled
                    if (tracker.enable3D && pose.keypoints3D && pose.keypoints3D.length > 0) {
                        tracker.drawKeypoints3D(pose.keypoints3D);
                    }
        
                    // Draw the centered box
                    tracker.ctx.save();
                    tracker.ctx.strokeStyle = 'red';  // Red box for better visibility
                    tracker.ctx.lineWidth = 3;
                    tracker.ctx.strokeRect(box.x, box.y, box.width, box.height);
                    tracker.ctx.restore();
        
                    // Display warning message if necessary
                    if (tracker.warningMessage) {
                        tracker.ctx.save();
                        tracker.ctx.font = '24px Arial';
                        tracker.ctx.fillStyle = 'red';
                        tracker.ctx.fillText(tracker.warningMessage, 20, 40);
                        tracker.ctx.restore();
                    }
                }
            }
        
            tracker.dispatch('afterupdate', tracker.poses);
        },
        
    drawPath: function(fromX, fromY, toX, toY, r, g, b, score) {
        let a = score - 0.15;
        if (a < 0) {
            a = 0.0;
        }
        tracker.drawLine(tracker.scaleX(fromX), tracker.scaleY(fromY), 
            tracker.scaleX(toX), tracker.scaleY(toY), 
            r, g, b, a);

        tracker.drawCircle(tracker.scaleX(fromX), tracker.scaleY(fromY), 
            r, g, b, a);
    },

    drawLine: function(fromX, fromY, toX, toY, r, g, b, a) {
        tracker.ctx.beginPath();
        tracker.ctx.lineWidth = tracker.pointWidth;
        tracker.ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        tracker.ctx.moveTo(fromX, fromY);
        tracker.ctx.lineTo(toX, toY);
        tracker.ctx.stroke();
        tracker.ctx.closePath();
    },


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

    log: function(...args) {
        if (tracker.log) {
            console.log(...args);
        }
    },

    setStatus: function(msg) {
        tracker.status = msg;
        tracker.dispatch('statuschange', tracker.status);
    },

    on: function(name, hook) {
        if (typeof tracker.hooks[name] === 'undefined') {
            return;
        }
        tracker.hooks[name].push(hook);
    },

    dispatch: function(name, event) {
        if (typeof tracker.hooks[name] === 'undefined') {
            return;
        }
        for (const hook of tracker.hooks[name]) {
            hook(event);
        }
    },

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
