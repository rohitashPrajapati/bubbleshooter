// ------------------------------------------------------------------------
// Bubble Shooter Game Tutorial With HTML5 And JavaScript
// Copyright (c) 2015 Rembound.com
// 
// This program is free software: you can redistribute it and/or modify  
// it under the terms of the GNU General Public License as published by  
// the Free Software Foundation, either version 3 of the License, or  
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,  
// but WITHOUT ANY WARRANTY; without even the implied warranty of  
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the  
// GNU General Public License for more details.  
// 
// You should have received a copy of the GNU General Public License  
// along with this program.  If not, see http://www.gnu.org/licenses/.
//
// http://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript
// ------------------------------------------------------------------------

// The function gets called when the window is fully loaded
window.onload = function() {
    // Get the canvas and context
    var canvas = document.getElementById("viewport");
    var context = canvas.getContext("2d");
    // Pause/Resume UI elements
    var pauseBtn = document.getElementById("pause-btn");
    var pausedOverlay = document.getElementById("paused-overlay");
    var resumeBtn = document.getElementById("resume-btn");
    var soundBtn = document.getElementById("sound-btn");
    var soundIcon = document.getElementById("sound-icon");
    var isPaused = false;
    var soundEnabled = true;
    
    // Responsive canvas setup for portrait mode
    function resizeCanvas() {
        var maxWidth = window.innerWidth;
        var maxHeight = window.innerHeight;
        var targetAspect = 11 / 16;
        var canvasWidth, canvasHeight;
        // On mobile, always fill the screen and increase playable area
        if (window.innerWidth <= 600) {
            // Mobile: canvas fills screen, game logic uses full available size
            canvasWidth = maxWidth;
            canvasHeight = maxHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';
            level.columns = 11;
        } else {
            // Desktop: keep original logic
            if (maxWidth / maxHeight > targetAspect) {
                canvasHeight = maxHeight;
                canvasWidth = maxHeight * targetAspect;
                if (canvasWidth > maxWidth) {
                    canvasWidth = maxWidth;
                    canvasHeight = maxWidth / targetAspect;
                }
            } else {
                canvasWidth = maxWidth;
                canvasHeight = maxWidth / targetAspect;
                if (canvasHeight > maxHeight) {
                    canvasHeight = maxHeight;
                    canvasWidth = maxHeight * targetAspect;
                }
            }
            canvas.width = Math.floor(canvasWidth);
            canvas.height = Math.floor(canvasHeight);
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
            level.columns = 12;
        }
        // Bubble sizing and grid fit
        // Adjust grid width and center horizontally to avoid right edge clipping
        var bubbleSize = Math.min(
            (canvas.width - bubbleGap * 2) / (level.columns + 0.5),
            canvas.height / (level.rows + 2)
        ) * bubbleSizeScale; // Use global scale
        level.tilewidth = bubbleSize - bubbleGap;
        level.tileheight = bubbleSize - bubbleGap;
        level.radius = (bubbleSize - bubbleGap) / 2;
        level.rowheight = level.tileheight * 0.95;
        level.width = level.columns * (level.tilewidth + bubbleGap) + (level.tilewidth + bubbleGap) / 2;
        // Center grid horizontally with left and right margin
        level.x = Math.floor((canvas.width - level.width) / 2);
        // Remove top/bottom gaps: playable area is full canvas
        var floorHeight = 2 * level.tileheight + 50;
        var floorTop = canvas.height - floorHeight;
        level.rows = Math.floor((canvas.height - level.y) / (level.rowheight + bubbleGap));
        level.height = canvas.height - level.y;
        totalRows = level.rows + 1;
        for (var i=0; i<level.columns; i++) {
            if (!level.tiles[i]) level.tiles[i] = [];
            for (var j=level.tiles[i].length; j<totalRows; j++) {
                level.tiles[i][j] = new Tile(i, j, -1, 0);
            }
        }
        player.x = level.x + level.width/2 - level.tilewidth/2;
        if (initialized) {
            positionShooterToFloor();
        }
    }
    
    // Resize handlers will be set up in init after resizeCanvas is defined
    
    // Timing and frames per second
    var lastframe = 0;
    var fpstime = 0;
    var framecount = 0;
    var fps = 0;
    
    var initialized = false;
    
    // Level
    var level = {
        x: 4,
        y: 0, // Start grid at top
        width: 0,
        height: 0,
        columns: 12, // Safe fit for bubbles
        rows: 14, // Number of visible tile rows
        tilewidth: 48.4 * bubbleSizeScale,
        tileheight: 48.4 * bubbleSizeScale,
        rowheight: 41.14 * bubbleSizeScale,
        radius: 24.2 * bubbleSizeScale,
        tiles: []
    };
    var totalRows = level.rows + 1; // Always keep one extra hidden row

    const bubbleGap = 1;

    // Define a tile class
    var Tile = function(x, y, type, shift) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.removed = false;
        this.shift = shift;
        this.velocity = 0;
        this.alpha = 1;
        this.processed = false;
    };
    
    // Player
    var player = {
        x: 0,
        y: 0,
        angle: 0,
        tiletype: 0,
        bubble: {
                    x: 0,
                    y: 0,
                    angle: 0,
                    speed: 2500, // Increased shooting speed
                    dropspeed: 900,
                    tiletype: 0,
                    visible: false
                },
        nextbubble: {
                        x: 0,
                        y: 0,
                        tiletype: 0
                    }
    };
    
    // Neighbor offset table
    var neighborsoffsets = [[[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]], // Even row tiles
                            [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]];  // Odd row tiles
    
    // Number of different colors
    var bubblecolors = 7;
    // Number of easy rows before increasing color complexity
    var easyRows = 30;
    // Track total rows added since game start
    var totalRowsAdded = 0;
    
    // Game states
    var gamestates = { init: 0, ready: 1, shootbubble: 2, removecluster: 3, gameover: 4 };
    var gamestate = gamestates.init;
    
    // Score
    var score = 0;
    
    var turncounter = 0;
    var rowoffset = 0;

    // Bubble size scale factor (global)
    var bubbleSizeScale = 1.0; //increase this in percentage like for 5% do it 1.05
    
    // Animation variables
    var animationstate = 0;
    var animationtime = 0;

    // Add global warning timer
    var warningTimer = 0;
    var warningActive = false;
    var lastWarningPlayed = 0;
    
    // Aim dots animation
    var aimDotsOffset = 0;     // distance offset along the path (pixels)
    var aimDotsSpeed = 120;    // pixels per second (slower)

    // Projection dot colors by bubble index (fill this array with your colors)
    // Example: ["#FFD700", "#FF0000", "#00FF00", ...]
    var projectionDotColors = ["#ffb500", "#681500", "#879901", "#efc362", "#fef9ea", "#fe9400", "#f4e09b"];

    // UI layout caches for floor placement so other renderers can align
    var uiFloorTop = 0;
    var uiFloorHeight = 0;
    var uiBaseLineY = 0;

    // Slow continuous downward drift of the bubble field
    var baseLevelFallSpeed = 13;        // base speed (pixels/sec)
    var minLevelFallSpeed = 0.7;        // minimum speed near floor (pixels/sec)
    var levelFallSpeed = baseLevelFallSpeed; // current speed
    var levelFallOffset = 0;           // 0..rowheight (pixels)

    // Clusters
    var showcluster = false;
    var cluster = [];
    var floatingclusters = [];
    // Bouncing fallen bubbles
    var fallingBubbles = [];
    var gravity = 2500; // Increased for faster bubble fall
    // Scattering effect parameters
    var scatterMinVX = 120; // minimum horizontal velocity (pixels/sec)
    var scatterMaxVX = 420; // maximum horizontal velocity (pixels/sec)
    var scatterBounceDamping = 0.85; // vertical bounce damping (higher for more elastic bounce)
    var upperBounceStrength = 1.0; // global multiplier for upper bounce effect
    var scatterBounceSpread = 0.25; // how much horizontal velocity increases after bounce
    
    // Images
    var images = [];
    var bubbleimage;
    
    // Audio (new)
    var sounds = {};
    // Master volume (0.0 - 1.0)
    var soundVolume = 0.15;
    
    // Image loading global variables
    var loadcount = 0;
    var loadtotal = 0;
    var preloaded = false;
    
    // Load images
    function loadImages(imagefiles) {
        // Initialize variables
        loadcount = 0;
        loadtotal = imagefiles.length;
        preloaded = false;
        
        // Load the images
        var loadedimages = [];
        for (var i=0; i<imagefiles.length; i++) {
            // Create the image object
            var image = new Image();
            
            // Add onload event handler
            image.onload = function () {
                loadcount++;
                if (loadcount == loadtotal) {
                    // Done loading
                    preloaded = true;
                }
            };
            
            // Set the source url of the image
            image.src = imagefiles[i];
            
            // Save to the image array
            loadedimages[i] = image;
        }
        
        // Return an array of images
        return loadedimages;
    }
    
    // Load sounds (call this from init)
    function loadSounds() {
        // Put your sound files at: ./sounds/pop.wav and ./sounds/bounce.wav (or change paths)
        try {
            sounds.stick = new Audio("./sounds/ball_stick.mp3"); // stick to another ball
            sounds.pop = new Audio("./sounds/pop_light.mp3"); // popping cluster
            sounds.bounce = new Audio("./sounds/ball_bounce.mp3"); // wall bounce
            sounds.warning = new Audio("./sounds/warning.mp3"); // warning near game over
            sounds.gameover = new Audio("./sounds/gameover.mp3"); // game over
            // set volumes via master volume
            sounds.stick.volume = soundVolume;
            sounds.pop.volume = soundVolume;
            sounds.bounce.volume = soundVolume;
            sounds.warning.volume = soundVolume;
            sounds.gameover.volume = soundVolume;
            // preload
            sounds.stick.load();
            sounds.pop.load();
            sounds.bounce.load();
            sounds.warning.load();
            sounds.gameover.load();
        } catch(e) {
            // ignore if audio can't be created
            sounds = {};
        }
    }

    // Play a sound. Use cloneNode to allow overlapping playback.
    function playSound(audio) {
        if (!audio || !soundEnabled) return;
        try {
            // ensure both the original and clone use current master volume
            try { audio.volume = soundVolume; } catch(e) {}
            var s = audio.cloneNode(true);
            try { s.volume = soundVolume; } catch(e2) {}
            s.play();
        } catch (e) {
            // Fallback: try to reset and play (may cut previous sound)
            try { audio.volume = soundVolume; audio.currentTime = 0; audio.play(); } catch(e2) {}
        }
    }
    
    // Helper: position the shooter and next bubble relative to bottom UI
    function positionShooterToFloor() {
        var floorHeight = 2*level.tileheight + 50;
        var floorTop = canvas.height - floorHeight;
        var desiredCenterY = floorTop + floorHeight - level.tileheight - 12;
        player.y = desiredCenterY - level.tileheight/2;
        // keep next bubble aligned left of shooter
        player.nextbubble.x = player.x - 2 * level.tilewidth;
        player.nextbubble.y = player.y;
        // also reset current flying bubble location if hidden
        if (!player.bubble.visible) {
            player.bubble.x = player.x;
            player.bubble.y = player.y;
        }
    }

    // Initialize the game
    function init() {
        // Initial canvas resize for portrait mode
        resizeCanvas();
        
        // Load sounds
        loadSounds();

        // Load images
        images = loadImages(["bubble-sprites.png"]);
        bubbleimage = images[0];
    
        // Add mouse events
        canvas.addEventListener("mousemove", onMouseMove);
        canvas.addEventListener("mousedown", onMouseDown);
        
        // Add touch events for mobile
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchstart", onTouchStart, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd, { passive: false });
        
        // Add resize handlers
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', function() {
            setTimeout(resizeCanvas, 100);
        });
        
        // Initialize the two-dimensional tile array
        for (var i=0; i<level.columns; i++) {
            level.tiles[i] = [];
            for (var j=0; j<totalRows; j++) {
                level.tiles[i][j] = new Tile(i, j, 0, 0);
            }
        }
        
        // Level dimensions are set in resizeCanvas, but ensure they're calculated here too
        level.width = level.columns * (level.tilewidth + bubbleGap) + (level.tilewidth + bubbleGap) / 2;
        level.height = level.rows * (level.rowheight + bubbleGap) + (level.tileheight - level.rowheight);
        
        // Init the player
        player.x = level.x + level.width/2 - level.tilewidth/2;
        player.y = level.y + level.height;
        player.angle = 90;
        player.tiletype = 0;
        
        player.nextbubble.x = player.x - 2 * level.tilewidth;
        player.nextbubble.y = player.y;

        // Position shooter to new bottom UI layout before creating bubbles
        positionShooterToFloor();
        
        // New game
        newGame();
        
        // Enter main loop
        main(0);
    }
    
    // Main loop
    function main(tframe) {
        window.requestAnimationFrame(main);
        if (!initialized) {
            // Preloader
            context.clearRect(0, 0, canvas.width, canvas.height);
            drawFrame();
            var loadpercentage = loadcount/loadtotal;
            context.strokeStyle = "#ff8080";
            context.lineWidth=3;
            context.strokeRect(18.5, 0.5 + canvas.height - 51, canvas.width-37, 32);
            context.fillStyle = "#ff8080";
            context.fillRect(18.5, 0.5 + canvas.height - 51, loadpercentage*(canvas.width-37), 32);
            var loadtext = "Loaded " + loadcount + "/" + loadtotal + " images";
            context.fillStyle = "#000000";
            context.font = "16px Verdana";
            context.fillText(loadtext, 18, 0.5 + canvas.height - 63);
            if (preloaded) {
                setTimeout(function(){initialized = true;}, 1000);
            }
        } else {
            // Pause logic: skip update/render if paused
            if (isPaused) {
                // Optionally, you can render a dimmed frame if desired
                render();
                return;
            }
            update(tframe);
            render();
        }
    }
    
    // Update the game state
    function update(tframe) {
        var dt = (tframe - lastframe) / 1000;
        lastframe = tframe;
        
        // Update the fps counter
        updateFps(dt);
        
        // Animate aiming dots
        aimDotsOffset += dt * aimDotsSpeed;

        // Smooth grid drop (belt animation)
        if (gamestate != gamestates.gameover) {
            // Calculate distance from first row to floor
            var firstRowY = level.y + levelFallOffset;
            var floorY = getFloorY();
            var distanceToFloor = floorY - firstRowY;
            var maxDistance = canvas.height - level.y; // maximum possible distance
            // Gradient: speed decreases as distanceToFloor decreases
            var speedRatio = Math.max(0, Math.min(1, distanceToFloor / maxDistance));
            // Interpolate between base and min speed
                // If warning is active, decrease speed to 5% of baseLevelFallSpeed
                if (warningActive) {
                    levelFallSpeed = baseLevelFallSpeed * 0.40;
                } else {
                    levelFallSpeed = minLevelFallSpeed + (baseLevelFallSpeed - minLevelFallSpeed) * speedRatio;
                }
            levelFallOffset += dt * levelFallSpeed;
            if (levelFallOffset >= level.rowheight) {
                levelFallOffset -= level.rowheight;
                addBubbles();
                rowoffset = (rowoffset + 1) % 2;
            }
            if (checkGameOver()) {
                return;
            }
        }

        if (gamestate == gamestates.ready) {
            // Game is ready for player input
        } else if (gamestate == gamestates.shootbubble) {
            // Bubble is moving
            stateShootBubble(dt);
        } else if (gamestate == gamestates.removecluster) {
            // Remove cluster and drop tiles
            stateRemoveCluster(dt);
        }
        // Always update falling bubbles physics
        updateFallingBubbles(dt);
        
        // Periodic warning logic
        var firstRowY = level.y + levelFallOffset;
        var floorY = getFloorY();
        var maxDistance = canvas.height - level.y;
        var dangerZone = maxDistance * 0.20;
        var bubblesInDanger = false;
        // Check if any bubble is within the bottom 20% area
        for (var i = 0; i < level.columns; i++) {
            for (var j = 0; j < level.rows; j++) {
                var tile = level.tiles[i][j];
                if (tile.type >= 0) {
                    var coord = getTileCoordinate(i, j);
                    if ((floorY - (coord.tiley + level.tileheight)) <= dangerZone) {
                        bubblesInDanger = true;
                        break;
                    }
                }
            }
            if (bubblesInDanger) break;
        }
        if (bubblesInDanger && gamestate != gamestates.gameover) {
            warningActive = true;
            warningTimer += dt;
            if (warningTimer - lastWarningPlayed >= 1.0) {
                playSound(sounds.warning);
                lastWarningPlayed = warningTimer;
            }
        } else {
            warningActive = false;
            warningTimer = 0;
            lastWarningPlayed = 0;
        }
    }
    
    function setGameState(newgamestate) {
        gamestate = newgamestate;
        
        animationstate = 0;
        animationtime = 0;
    }
    
    function stateShootBubble(dt) {
        // Bubble is moving
        
        // Move the bubble in the direction of the mouse
        player.bubble.x += dt * player.bubble.speed * Math.cos(degToRad(player.bubble.angle));
        player.bubble.y += dt * player.bubble.speed * -1*Math.sin(degToRad(player.bubble.angle));
        
        // Handle left and right collisions with the level
        if (player.bubble.x <= level.x) {
            // Left edge
            player.bubble.angle = 180 - player.bubble.angle;
            player.bubble.x = level.x;
            // play bounce sound
            playSound(sounds.bounce);
        } else if (player.bubble.x + level.tilewidth >= level.x + level.width) {
            // Right edge
            player.bubble.angle = 180 - player.bubble.angle;
            player.bubble.x = level.x + level.width - level.tilewidth;
            // play bounce sound
            playSound(sounds.bounce);
        }
 
        // Collisions with the top of the level
        var topY = level.y + levelFallOffset;
        if (player.bubble.y <= topY) {
            // Top collision
            player.bubble.y = topY;
            snapBubble();
            return;
        }
        
        // Collisions with other tiles
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                var tile = level.tiles[i][j];
                
                // Skip empty tiles
                if (tile.type < 0) {
                    continue;
                }
                
                // Check for intersections
                var coord = getTileCoordinate(i, j);
                if (circleIntersection(player.bubble.x + level.tilewidth/2,
                                       player.bubble.y + level.tileheight/2,
                                       level.radius,
                                       coord.tilex + level.tilewidth/2,
                                       coord.tiley + level.tileheight/2,
                                       level.radius)) {
                                        
                    // Intersection with a level bubble
                    snapBubble();
                    return;
                }
            }
        }
    }
    
    function stateRemoveCluster(dt) {
        if (animationstate == 0) {
            resetRemoved();
            
            // Mark the tiles as removed
            for (var i=0; i<cluster.length; i++) {
                // Set the removed flag
                cluster[i].removed = true;
            }
            
            // Add cluster score
            score += cluster.length * 100;
            // Play pop sound when popping cluster
            if (cluster.length > 0) {
                playSound(sounds.pop);
                // Convert matched cluster itself to falling bubbles (scatter upward before falling)
                for (var c=0; c<cluster.length; c++) {
                    var ct = cluster[c];
                    var ccoord = getTileCoordinate(ct.x, ct.y);
                    // Scatter upward with random velocities
                    var scatterVX = (Math.random() < 0.5 ? -1 : 1) * (scatterMinVX + Math.random() * (scatterMaxVX - scatterMinVX));
                    var scatterVY = - (350 + Math.random() * 250); // Upward velocity
                    fallingBubbles.push({
                        x: ccoord.tilex + level.tilewidth/2,
                        y: ccoord.tiley + level.tileheight/2,
                        r: level.radius,
                        type: ct.type,
                        vy: scatterVY,
                        vx: scatterVX,
                        bouncedOnce: false,
                        scatterUp: true,
                        scatterTimer: 0,
                        initialY: ccoord.tiley + level.tileheight/2 // Track initial Y for bounce strength
                    });
                    // Remove from grid immediately
                    ct.type = -1;
                    ct.shift = 0;
                    ct.alpha = 1;
                }
            }
            // Find floating clusters
            floatingclusters = findFloatingClusters();
            if (floatingclusters.length > 0) {
                // Convert floating clusters into independent falling bubbles with bounce
                for (var i=0; i<floatingclusters.length; i++) {
                    for (var j=0; j<floatingclusters[i].length; j++) {
                        var tile = floatingclusters[i][j];
                        var coord = getTileCoordinate(tile.x, tile.y);
                        var scatterVX = (Math.random() < 0.5 ? -1 : 1) * (scatterMinVX + Math.random() * (scatterMaxVX - scatterMinVX));
                        fallingBubbles.push({
                            x: coord.tilex + level.tilewidth/2 + (Math.random()*10-5),
                            y: coord.tiley + level.tileheight/2,
                            r: level.radius,
                            type: tile.type,
                            vy: 0,
                            vx: scatterVX,
                            bouncedOnce: false
                        });
                        // Remove from grid immediately
                        tile.type = -1;
                        tile.shift = 0;
                        tile.alpha = 1;
                    }
                }
            }
            
            animationstate = 1;
        }
        
        if (animationstate == 1) {
            // Pop bubbles
            var tilesleft = false;
            for (var i=0; i<cluster.length; i++) {
                var tile = cluster[i];
                
                if (tile.type >= 0) {
                    tilesleft = true;
                    
                    // Alpha animation
                    tile.alpha -= dt * 15;
                    if (tile.alpha < 0) {
                        tile.alpha = 0;
                    }

                    if (tile.alpha == 0) {
                        tile.type = -1;
                        tile.alpha = 1;
                    }
                }                
            }
            
            // Drop bubbles handled by independent falling bubble physics
            
            if (!tilesleft) {
                // Next bubble
                nextBubble();
                
                // Check for game over
                var tilefound = false
                for (var i=0; i<level.columns; i++) {
                    for (var j=0; j<level.rows; j++) {
                        if (level.tiles[i][j].type != -1) {
                            tilefound = true;
                            break;
                        }
                    }
                }
                
                if (tilefound) {
                    setGameState(gamestates.ready);
                } else {
                    // No tiles left, game over
                    setGameState(gamestates.gameover);
                }
            }
        }
    }
    
    function getFloorY() {
        // Prefer the top of the score baseline if available
        if (uiBaseLineY && uiBaseLineY > 0) {
            return uiBaseLineY;
        }
        var yoffset = level.tileheight/2;
        return level.y - 4 + level.height + 4 - yoffset;
    }

    function getSegmentIndex(x) {
        var clamped = Math.max(level.x, Math.min(x, level.x + level.width));
        var rel = (clamped - level.x) / level.width;
        var idx = Math.floor(rel * 5);
        if (idx < 0) idx = 0;
        if (idx > 4) idx = 4;
        return idx;
    }

    function getSegmentScore(idx) {
        var table = [300, 400, 500, 400, 300];
        return table[idx] || 0;
    }

    function updateFallingBubbles(dt) {
        if (fallingBubbles.length === 0) return;
        var floorY = getFloorY();
        var topBounceY = level.y + level.tileheight/2; // Top bounce line
        for (var i = fallingBubbles.length - 1; i >= 0; i--) {
            var b = fallingBubbles[i];
            // Add horizontal scatter movement
            if (typeof b.vx === 'undefined') b.vx = 0;
            // If bubble is in scatterUp phase, let it move upward for a short time before gravity applies
            if (b.scatterUp) {
                b.scatterTimer += dt;
                // Scatter upward for 0.25s, then switch to normal gravity
                if (b.scatterTimer < 0.25) {
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    continue;
                } else {
                    b.scatterUp = false;
                }
            }
            b.vy += gravity * dt;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            // Bounce at the top if bubble is moving up and hits the top
            if (b.y - b.r <= topBounceY && b.vy < 0) {
                b.y = topBounceY + b.r;
                b.vy = Math.abs(b.vy) * scatterBounceDamping * upperBounceStrength; // Bounce downward, controlled by global
                b.vx = b.vx * (1 + scatterBounceSpread * (Math.random() - 0.5));
                playSound(sounds.bounce);
            }
            var contactY = floorY - b.r;
            if (b.y >= contactY) {
                b.y = contactY;
                // Multiple bounce effect
                if (typeof b.bounceCount === 'undefined') b.bounceCount = 0;
                if (b.bounceCount < 3) { // Allow up to 3 bounces
                    var segIdx1 = getSegmentIndex(b.x);
                    if (b.bounceCount === 0) score += getSegmentScore(segIdx1); // Only score on first contact
                    // Bounce strength depends on fall height, but limit bounce so it can't go above half the play field
                    var fallHeight = (typeof b.initialY !== 'undefined') ? Math.max(0, contactY - b.initialY) : 0;
                    var bounceStrength = 0.5 + Math.min(1.0, fallHeight / (canvas.height * 0.5)); // 0.5 to 1.5 multiplier
                    var vyBounce = Math.abs(b.vy) * scatterBounceDamping * bounceStrength;
                    // Calculate max bounce velocity so bubble can't reach above half the play field
                    var maxBounceHeight = canvas.height * 0.5;
                    var maxVy = Math.sqrt(2 * gravity * maxBounceHeight);
                    b.vy = -Math.min(Math.max(220, vyBounce), maxVy);
                    b.vx = b.vx * (1 + scatterBounceSpread * (Math.random() - 0.5));
                    b.bounceCount++;
                    playSound(sounds.bounce);
                } else {
                    // Remove after last bounce
                    fallingBubbles.splice(i, 1);
                }
            }
        }
    }
    
    // Snap bubble to the grid
    function snapBubble() {
        // Get the grid position
        var centerx = player.bubble.x + level.tilewidth/2;
        var centery = player.bubble.y + level.tileheight/2;
        var gridpos = getGridPosition(centerx, centery);

        // Make sure the grid position is valid
        if (gridpos.x < 0) {
            gridpos.x = 0;
        }
            
        if (gridpos.x >= level.columns) {
            gridpos.x = level.columns - 1;
        }

        if (gridpos.y < 0) {
            gridpos.y = 0;
        }
            
        if (gridpos.y >= level.rows) {
            gridpos.y = level.rows - 1;
        }

        // Check if the tile is empty
        var addtile = false;
        if (level.tiles[gridpos.x][gridpos.y].type != -1) {
            // Tile is not empty, shift the new tile downwards
            for (var newrow=gridpos.y+1; newrow<level.rows; newrow++) {
                if (level.tiles[gridpos.x][newrow].type == -1) {
                    gridpos.y = newrow;
                    addtile = true;
                    break;
                }
            }
        } else {
            addtile = true;
        }

        // Add the tile to the grid
        if (addtile) {
            player.bubble.visible = false;
            level.tiles[gridpos.x][gridpos.y].type = player.bubble.tiletype;
            // play stick sound when bubble attaches
            playSound(sounds.stick);
            
            // Check for game over
            if (checkGameOver()) {
                return;
            }
            
            // Find clusters
            cluster = findCluster(gridpos.x, gridpos.y, true, true, false);
            
            if (cluster.length >= 3) {
                // Remove the cluster
                setGameState(gamestates.removecluster);
                return;
            }
        }
        
        // No clusters found
        turncounter++;
        if (turncounter >= 5) {
            // Add a row of bubbles
            addBubbles();
            turncounter = 0;
            rowoffset = (rowoffset + 1) % 2;
            
            if (checkGameOver()) {
                return;
            }
        }

        // Next bubble
        nextBubble();
        setGameState(gamestates.ready);
    }
    
    function checkGameOver() {
        // Only check for game over if the game is running
        if (gamestate !== gamestates.ready && gamestate !== gamestates.shootbubble && gamestate !== gamestates.removecluster) {
            return false;
        }
        var warningPlayed = false;
        var floorY = getFloorY();
        // Game over if any bubble is at or below the floor line
        for (var i = 0; i < level.columns; i++) {
            for (var j = 0; j < level.rows; j++) {
                var tile = level.tiles[i][j];
                if (tile.type != -1) {
                    var coord = getTileCoordinate(i, j);
                    // If the bottom of the bubble is at or below the floorY
                    if (coord.tiley + level.tileheight >= floorY-26) {
                        if (!warningPlayed && gamestate != gamestates.gameover) {
                            playSound(sounds.warning);
                            warningPlayed = true;
                        }
                        nextBubble();
                        setGameState(gamestates.gameover);
                        playSound(sounds.gameover);
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    function addBubbles() {
        // Shift all rows down
        for (var i=0; i<level.columns; i++) {
            for (var j=totalRows-1; j>0; j--) {
                level.tiles[i][j].type = level.tiles[i][j-1].type;
            }
        }
        // Add a new hidden row at the top
        var currentRowCount = 0;
        // Count non-hidden rows
        for (var j = 0; j < totalRows; j++) {
            if (level.tiles[0][j].type !== -1) currentRowCount++;
        }
        totalRowsAdded++;
        var colorCount = bubblecolors;
        if (totalRowsAdded <= easyRows) {
            colorCount = Math.min(3, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 10) {
            colorCount = Math.min(4, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 20) {
            colorCount = Math.min(5, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 30) {
            colorCount = Math.min(6, bubblecolors);
        } else {
            colorCount = bubblecolors;
        }
        for (var i=0; i<level.columns; i++) {
            level.tiles[i][0].type = randRange(0, colorCount-1);
        }
        // The newRowAnimating flag is set in the update function before calling this
    }
    
    // Find the remaining colors
    function findColors() {
        var foundcolors = [];
        var colortable = [];
        for (var i=0; i<bubblecolors; i++) {
            colortable.push(false);
        }
        
        // Check all tiles
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                var tile = level.tiles[i][j];
                if (tile.type >= 0) {
                    if (!colortable[tile.type]) {
                        colortable[tile.type] = true;
                        foundcolors.push(tile.type);
                    }
                }
            }
        }
        
        return foundcolors;
    }
    
    // Find cluster at the specified tile location
    function findCluster(tx, ty, matchtype, reset, skipremoved) {
        // Reset the processed flags
        if (reset) {
            resetProcessed();
        }
        
        // Get the target tile. Tile coord must be valid.
        var targettile = level.tiles[tx][ty];
        
        // Initialize the toprocess array with the specified tile
        var toprocess = [targettile];
        targettile.processed = true;
        var foundcluster = [];

        while (toprocess.length > 0) {
            // Pop the last element from the array
            var currenttile = toprocess.pop();
            
            // Skip processed and empty tiles
            if (currenttile.type == -1) {
                continue;
            }
            
            // Skip tiles with the removed flag
            if (skipremoved && currenttile.removed) {
                continue;
            }
            
            // Check if current tile has the right type, if matchtype is true
            if (!matchtype || (currenttile.type == targettile.type)) {
                // Add current tile to the cluster
                foundcluster.push(currenttile);
                
                // Get the neighbors of the current tile
                var neighbors = getNeighbors(currenttile);
                
                // Check the type of each neighbor
                for (var i=0; i<neighbors.length; i++) {
                    if (!neighbors[i].processed) {
                        // Add the neighbor to the toprocess array
                        toprocess.push(neighbors[i]);
                        neighbors[i].processed = true;
                    }
                }
            }
        }
        
        // Return the found cluster
        return foundcluster;
    }
    
    // Find floating clusters
    function findFloatingClusters() {
        // Reset the processed flags
        resetProcessed();
        
        var foundclusters = [];
        
        // Check all tiles
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                var tile = level.tiles[i][j];
                if (!tile.processed) {
                    // Find all attached tiles
                    var foundcluster = findCluster(i, j, false, false, true);
                    
                    // There must be a tile in the cluster
                    if (foundcluster.length <= 0) {
                        continue;
                    }
                    
                    // Check if the cluster is floating
                    var floating = true;
                    for (var k=0; k<foundcluster.length; k++) {
                        if (foundcluster[k].y == 0) {
                            // Tile is attached to the roof
                            floating = false;
                            break;
                        }
                    }
                    
                    if (floating) {
                        // Found a floating cluster
                        foundclusters.push(foundcluster);
                    }
                }
            }
        }
        
        return foundclusters;
    }
    
    // Reset the processed flags
    function resetProcessed() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                level.tiles[i][j].processed = false;
            }
        }
    }
    
    // Reset the removed flags
    function resetRemoved() {
        for (var i=0; i<level.columns; i++) {
            for (var j=0; j<level.rows; j++) {
                level.tiles[i][j].removed = false;
            }
        }
    }
    
    // Get the neighbors of the specified tile
    function getNeighbors(tile) {
        var tilerow = (tile.y + rowoffset) % 2; // Even or odd row
        var neighbors = [];
        
        // Get the neighbor offsets for the specified tile
        var n = neighborsoffsets[tilerow];
        
        // Get the neighbors
        for (var i=0; i<n.length; i++) {
            // Neighbor coordinate
            var nx = tile.x + n[i][0];
            var ny = tile.y + n[i][1];
            
            // Make sure the tile is valid
            if (nx >= 0 && nx < level.columns && ny >= 0 && ny < level.rows) {
                neighbors.push(level.tiles[nx][ny]);
            }
        }
        
        return neighbors;
    }
    
    function updateFps(dt) {
        if (fpstime > 0.25) {
            // Calculate fps
            fps = Math.round(framecount / fpstime);
            
            // Reset time and framecount
            fpstime = 0;
            framecount = 0;
        }
        
        // Increase time and framecount
        fpstime += dt;
        framecount++;
    }
    
    // Draw text that is centered
    function drawCenterText(text, x, y, width) {
        var textdim = context.measureText(text);
        context.fillText(text, x + (width-textdim.width)/2, y);
    }
    
    // Render the game
    function render() {
        // Draw the frame around the game
        drawFrame();
        
        var yoffset =  level.tileheight/2;
        
        // Draw level background
        context.fillStyle = "#151929"; // darker game area background
        context.fillRect(level.x - 4, level.y - 4, level.width + 8, level.height + 18);
        
        // Render tiles
        renderTiles();
        
        // Draw level bottom (anchor to canvas bottom so no blank space remains)
        context.fillStyle = "#101422"; // dark floor band
        var floorHeight = 2*level.tileheight + 50; // floor band height
        var floorTop = canvas.height - floorHeight; // stick to bottom edge
        // cache for other renderers
        uiFloorTop = floorTop;
        uiFloorHeight = floorHeight;
        context.fillRect(level.x - 4, floorTop, level.width + 8, floorHeight);
        // Update level.height so the bubble area background extends to the top of the score floor
        level.height = floorTop;

        // Top baseline across floor (placed above the score area)
        var baseLineHeight = 10;
        var baseLineY = floorTop + 26; // just below labels
        uiBaseLineY = baseLineY;
        context.fillStyle = "#3b59ff"; // bright blue baseline
        context.fillRect(level.x - 4, baseLineY, level.width + 8, baseLineHeight);

        // Draw 5 scoring segments and their labels
        var segmentWidth = level.width / 5;
        var scores = [300, 400, 500, 400, 300];
        for (var s=0; s<5; s++) {
            var sx = level.x + s*segmentWidth;
            // Rounded pillar-like separator centered in each segment boundary
            if (s > 0) {
                var pillarWidth = 18;
                // Compute full available height from baseline to near bottom, then use half
                var bottomMargin = 10; // space above the bottom of floor
                var fullHeight = Math.max(0, (floorTop + floorHeight - bottomMargin) - (baseLineY + baseLineHeight));
                var pillarHeight = Math.max(12, Math.floor(fullHeight / 2));
                var px = Math.round(sx - pillarWidth/2);
                var py = baseLineY + (baseLineHeight / 2) - pillarHeight; // attach directly under baseline
                context.fillStyle =  "#3854ff";
                context.strokeStyle = "#1c2b6600";
                drawRoundedRectTopCorners(px, py, pillarWidth, pillarHeight, 10);
                context.fill();
            }
            context.fillStyle = "#4e6cff"; // blue labels
            context.font = "bold 20px Verdana"; // bold labels
            // place labels near the top of the floor band so they're above the shooter
            drawCenterText(scores[s].toString(), sx, floorTop + 20, segmentWidth);
        }
        
        // Show score at top left for mobile, top center for desktop
        var scoreMobileDiv = document.getElementById('score-mobile');
        if (window.innerWidth <= 600 && scoreMobileDiv) {
            scoreMobileDiv.textContent = String(score);
        } else {
            context.save();
            context.font = "bold 54px Verdana";
            context.fillStyle = "#cfd6ff";
            context.textAlign = "center";
            context.globalAlpha = 1.0; // Slightly transparent overlay
            var scoreX = level.x + level.width / 2;
            var scoreY = level.y + 60; // 60px from top of play field
            context.fillText(String(score), scoreX, scoreY);
            context.globalAlpha = 1.0;
            context.restore();
            if (scoreMobileDiv) scoreMobileDiv.textContent = "";
        }

        // Render cluster
        if (showcluster) {
            renderCluster(cluster, 255, 128, 128);
            
            for (var i=0; i<floatingclusters.length; i++) {
                var col = Math.floor(100 + 100 * i / floatingclusters.length);
                renderCluster(floatingclusters[i], col, col, col);
            }
        }
        
        
        // Render player bubble
        renderPlayer();
        // Render falling bubbles after player for visibility
        renderFallingBubbles();
        
        // Game Over overlay
        if (gamestate == gamestates.gameover) {
            context.fillStyle = "rgba(0, 0, 0, 0.8)";
            // Cover the entire game area including the scoring floor
            context.fillRect(level.x - 4, level.y - 4, level.width + 8, canvas.height - level.y + 8);
            context.fillStyle = "#ffffff";
            context.font = "24px Verdana";
            drawCenterText("Game Over!", level.x, level.y + (canvas.height - level.y) / 2 + 10, level.width);
            drawCenterText("Click to start", level.x, level.y + (canvas.height - level.y) / 2 + 40, level.width);
        }
    }

    function renderFallingBubbles() {
        if (fallingBubbles.length === 0) return;
        var floorY = getFloorY();
        for (var i=0; i<fallingBubbles.length; i++) {
            var b = fallingBubbles[i];
            // Draw white blur disk shadow if bubble is at the floor
            if (Math.abs(b.y - (floorY - b.r)) < 2) {
                context.save();
                context.globalAlpha = 0.85; // Increased opacity
                context.filter = 'blur(8px)';
                context.beginPath();
                context.arc(b.x, floorY + 8, b.r * 1.2, 0, Math.PI * 2);
                context.fillStyle = 'white';
                context.fill();
                context.filter = 'none';
                context.globalAlpha = 1.0;
                context.restore();
            }
            drawBubble(b.x - level.tilewidth/2, b.y - level.tileheight/2, b.type);
        }
    }
    
    // Draw a frame around the game
    function drawFrame() {
        // Draw background
        context.fillStyle = "#0b0f1c"; // page background
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw header
        // context.fillStyle = "#0a0d19";
        // context.fillRect(0, 0, canvas.width, 79);
        
        // // Draw title
        // context.fillStyle = "#dbe3ff";
        // context.font = "24px Verdana";
        // context.fillText("Bubble Shooter", 10, 37);
        
        // // Display fps
        // context.fillStyle = "#9fb2ff";
        // context.font = "12px Verdana";
        // context.fillText("Fps: " + fps, 13, 57);
    }

    // Draw a rounded rectangle path (not filled/stroked yet)
    function drawRoundedRect(x, y, w, h, r) {
        var rr = Math.min(r, Math.floor(Math.min(w, h) / 2));
        context.beginPath();
        context.moveTo(x + rr, y);
        context.lineTo(x + w - rr, y);
        context.arc(x + w - rr, y + rr, rr, -Math.PI/2, 0, false);
        context.lineTo(x + w, y + h - rr);
        context.arc(x + w - rr, y + h - rr, rr, 0, Math.PI/2, false);
        context.lineTo(x + rr, y + h);
        context.arc(x + rr, y + h - rr, rr, Math.PI/2, Math.PI, false);
        context.lineTo(x, y + rr);
        context.arc(x + rr, y + rr, rr, Math.PI, 1.5*Math.PI, false);
        context.closePath();
    }

    // Draw a rounded rectangle with only the top-left and top-right corners rounded
    function drawRoundedRectTopCorners(x, y, w, h, r) {
        var rr = Math.min(r, Math.floor(Math.min(w, h) / 2));
        context.beginPath();
        context.moveTo(x, y + h);
        context.lineTo(x, y + rr);
        context.arc(x + rr, y + rr, rr, Math.PI, 1.5*Math.PI, false); // top-left corner
        context.lineTo(x + w - rr, y);
        context.arc(x + w - rr, y + rr, rr, -Math.PI/2, 0, false); // top-right corner
        context.lineTo(x + w, y + h);
        context.lineTo(x, y + h);
        context.closePath();
    }
    
    // Render tiles
    function renderTiles() {
        // Render only rows that are at least partially visible in the game area
        for (var j = 0; j < totalRows; j++) {
            for (var i = 0; i < level.columns; i++) {
                var tile = level.tiles[i][j];
                var shift = tile.shift;
                var coord = getTileCoordinate(i, j);
                var y = coord.tiley + shift;
                // Only render if at least part of the tile is visible in the game area
                if (y + level.tileheight > level.y && y < level.y + level.height) {
                    if (tile.type >= 0) {
                        context.save();
                        context.globalAlpha = tile.alpha;
                        drawBubble(coord.tilex, y, tile.type);
                        context.restore();
                    }
                }
            }
        }
    }

    
    
    // Render cluster
    function renderCluster(cluster, r, g, b) {
        for (var i=0; i<cluster.length; i++) {
            // Calculate the tile coordinates
            var coord = getTileCoordinate(cluster[i].x, cluster[i].y);
            
            // Draw the tile using the color
            context.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
            context.fillRect(coord.tilex+level.tilewidth/4, coord.tiley+level.tileheight/4, level.tilewidth/2, level.tileheight/2);
        }
    }
    
    // Render the player bubble
    function renderPlayer() {
        // Align shooter vertically to floor band each frame
        var desiredCenterY = uiFloorTop + uiFloorHeight - level.tileheight - 12; // keep comfortably above bottom edge
        player.y = desiredCenterY - level.tileheight/2;
        var centerx = player.x + level.tilewidth/2;
        var centery = desiredCenterY;
        
        // Draw player background circle
        context.fillStyle = "#0e1324";
        context.beginPath();
        context.arc(centerx, centery, level.radius+12, 0, 2*Math.PI, false);
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = "#1d2a55";
        context.stroke();

        // Draw dotted aim projection
        renderAimDots(centerx, centery);
        
        // Draw the next bubble
        // keep next-bubble positioned left of shooter and vertically aligned
        player.nextbubble.x = player.x - 2 * level.tilewidth;
        player.nextbubble.y = player.y;
        drawBubble(player.nextbubble.x, player.nextbubble.y, player.nextbubble.tiletype);
        
        // Draw the bubble
        if (player.bubble.visible) {
            drawBubble(player.bubble.x, player.bubble.y, player.bubble.tiletype);
        }
        
    }

    // Render aiming dots with simple wall bounces
    function renderAimDots(startX, startY) {
        // Do not draw while bubble is flying
        if (gamestate != gamestates.ready) return;
        var angle = degToRad(player.angle);
        var dirx = Math.cos(angle);
        var diry = -Math.sin(angle);
        var x = startX;
        var y = startY;
        var step = 36; // increased pixels per dot spacing for more distance
        var maxDots = 22;
        var leftBound = level.x + level.tilewidth/2;
        var rightBound = level.x + level.width - level.tilewidth/2;
        var topStop = level.y + level.tileheight/2; // roof stop
        // Set dot color based on shooter bubble index
        var dotColor = projectionDotColors[player.tiletype] || "#FFD700";
        context.fillStyle = dotColor;
        // Start with a partial step so dots appear to move forward
        var advance = aimDotsOffset % step;
        var dots = 0;
        var dotRadius = 8; // bigger dot size
        while (dots < maxDots) {
            // advance by current segment length (partial for first, full afterwards)
            x += dirx * advance;
            y += diry * advance;
            // bounce on side walls using center bounds
            if (x <= leftBound) {
                x = leftBound + (leftBound - x);
                dirx = -dirx;
            } else if (x >= rightBound) {
                x = rightBound - (x - rightBound);
                dirx = -dirx;
            }
            // stop near the top
            if (y <= topStop) break;

            // collision against existing bubbles
            var hit = false;
            for (var ci=0; ci<level.columns && !hit; ci++) {
                for (var cj=0; cj<level.rows && !hit; cj++) {
                    var t = level.tiles[ci][cj];
                    if (t.type < 0) continue;
                    var c = getTileCoordinate(ci, cj);
                    // compare centers
                    if (circleIntersection(x, y, level.radius, c.tilex + level.tilewidth/2, c.tiley + level.tileheight/2, level.radius)) {
                        hit = true;
                    }
                }
            }

            // draw current dot
            context.beginPath();
            context.arc(x, y, dotRadius, 0, Math.PI*2, false);
            context.fill();

            // If we hit a bubble, stop drawing more dots
            if (hit) break;
            // after first iteration, always advance by full step
            advance = step;
            dots++;
        }
    }
    
    // Get the tile coordinate
    function getTileCoordinate(column, row) {
        var tilex = level.x + column * (level.tilewidth + bubbleGap);
        if ((row + rowoffset) % 2) {
            tilex += (level.tilewidth + bubbleGap) / 2;
        }
        // Animate the entire grid together, including the top row
        var tiley = level.y + levelFallOffset + row * (level.rowheight + bubbleGap);
        return { tilex: tilex, tiley: tiley };
    }
    
    // Get the closest grid position
    function getGridPosition(x, y) {
        var gridy = Math.floor((y - level.y - levelFallOffset) / (level.rowheight + bubbleGap));
        
        // Check for offset
        var xoffset = 0;
        if ((gridy + rowoffset) % 2) {
            xoffset = (level.tilewidth + bubbleGap) / 2;
        }
        var gridx = Math.floor(((x - xoffset) - level.x) / (level.tilewidth + bubbleGap));
        
        return { x: gridx, y: gridy };
    }

    
    // Draw the bubble
    function drawBubble(x, y, index) {
        if (index < 0 || index >= bubblecolors)
            return;
        
        // Draw the bubble sprite
        context.drawImage(bubbleimage, index * 2048, 0, 2048, 2078, x, y, level.tilewidth, level.tileheight);
    }
    
    // Start a new game
    function newGame() {
        // Reset score
        score = 0;
        
        turncounter = 0;
        rowoffset = 0;
        levelFallOffset = 0;
        
        totalRowsAdded = 0; // Reset on new game
        
        // Set the gamestate to ready
        setGameState(gamestates.ready);
        
        // Create the level
        createLevel();

        // Init the next bubble and set the current bubble
        nextBubble();
        nextBubble();
        // Re-apply positioning after bubble generation
        positionShooterToFloor();
    }
    
    // Create a random level
    function createLevel() {
        // Create a level with random tiles
        totalRowsAdded = totalRows; // Start with all rows drawn
        // Generate vertical/random honeycomb-like groups
        for (var i=0; i<level.columns; i++) {
            var colorCount = bubblecolors;
            var groupSize = 3;
            if (totalRowsAdded <= easyRows) {
                colorCount = Math.min(3, bubblecolors);
                groupSize = 4;
            } else if (totalRowsAdded <= easyRows + 10) {
                colorCount = Math.min(4, bubblecolors);
                groupSize = 2;
            } else {
                colorCount = bubblecolors;
                groupSize = 1;
            }
            var randomtile = randRange(0, colorCount-1);
            var count = 0;
            for (var j=0; j<totalRows; j++) {
                if (count >= groupSize) {
                    var newtile = randRange(0, colorCount-1);
                    if (newtile == randomtile) {
                        newtile = (newtile + 1) % colorCount;
                    }
                    randomtile = newtile;
                    count = 0;
                }
                count++;
                // Fill visible rows and hidden row with bubbles
                if (j < level.rows/2 || j == totalRows-1) {
                    // Add randomness for honeycomb effect
                    if (Math.random() < 0.5) {
                        level.tiles[i][j].type = randomtile;
                    } else {
                        level.tiles[i][j].type = randRange(0, colorCount-1);
                    }
                } else {
                    level.tiles[i][j].type = -1;
                }
            }
        }
    }
    
    // Create a random bubble for the player
    function nextBubble() {
        // Set the current bubble
        player.tiletype = player.nextbubble.tiletype;
        player.bubble.tiletype = player.nextbubble.tiletype;
        player.bubble.x = player.x;
        player.bubble.y = player.y;
        player.bubble.visible = true;
        
        var colorCount = bubblecolors;
        if (totalRowsAdded <= easyRows) {
            colorCount = Math.min(3, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 5) {
            colorCount = Math.min(4, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 10) {
            colorCount = Math.min(5, bubblecolors);
        } else if (totalRowsAdded <= easyRows + 15) {
            colorCount = Math.min(6, bubblecolors);
        } else {
            colorCount = bubblecolors;
        }
        var nextcolor = randRange(0, colorCount-1);
        player.nextbubble.tiletype = nextcolor;
    }
    
    // Get a random existing color
    function getExistingColor() {
        existingcolors = findColors();
        
        var bubbletype = 0;
        if (existingcolors.length > 0) {
            bubbletype = existingcolors[randRange(0, existingcolors.length-1)];
        }
        
        return bubbletype;
    }
    
    // Get a random int between low and high, inclusive
    function randRange(low, high) {
        return Math.floor(low + Math.random()*(high-low+1));
    }
    
    // Shoot the bubble
    function shootBubble() {
        // Shoot the bubble in the direction of the mouse
        player.bubble.x = player.x;
        player.bubble.y = player.y;
        player.bubble.angle = player.angle;
        player.bubble.tiletype = player.tiletype;

        // Set the gamestate
        setGameState(gamestates.shootbubble);
    }
    
    // Check if two circles intersect
    function circleIntersection(x1, y1, r1, x2, y2, r2) {
        // Calculate the distance between the centers
        var dx = x1 - x2;
        var dy = y1 - y2;
        var len = Math.sqrt(dx * dx + dy * dy);
        
        if (len < r1 + r2) {
            // Circles intersect
            return true;
        }
        
        return false;
    }
    
    // Convert radians to degrees
    function radToDeg(angle) {
        return angle * (180 / Math.PI);
    }
    
    // Convert degrees to radians
    function degToRad(angle) {
        return angle * (Math.PI / 180);
    }

    // On mouse movement
    function onMouseMove(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);

        // Get the mouse angle
        var mouseangle = radToDeg(Math.atan2((player.y+level.tileheight/2) - pos.y, pos.x - (player.x+level.tilewidth/2)));

        // Convert range to 0, 360 degrees
        if (mouseangle < 0) {
            mouseangle = 180 + (180 + mouseangle);
        }

        // Restrict angle to 8, 172 degrees
        var lbound = 8;
        var ubound = 172;
        if (mouseangle > 90 && mouseangle < 270) {
            // Left
            if (mouseangle > ubound) {
                mouseangle = ubound;
            }
        } else {
            // Right
            if (mouseangle < lbound || mouseangle >= 270) {
                mouseangle = lbound;
            }
        }

        // Set the player angle
        player.angle = mouseangle;
    }
    
    // On mouse button click
    function onMouseDown(e) {
        // Get the mouse position
        var pos = getMousePos(canvas, e);
        
        if (gamestate == gamestates.ready) {
            shootBubble();
        } else if (gamestate == gamestates.gameover) {
            newGame();
        }
    }
    
    // Get the mouse position
    function getMousePos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((e.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }
    
    // Get touch position (similar to mouse position)
    function getTouchPos(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        var touch = e.touches[0] || e.changedTouches[0];
        return {
            x: Math.round((touch.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((touch.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }
    
    // Touch event handlers

    // Track drag state for mobile shooting
    var isTouchDragging = false;
    var dragStartPos = null;

    function onTouchMove(e) {
        e.preventDefault();
        var pos = getTouchPos(canvas, e);
        // Mark as dragging if moved
        if (!isTouchDragging && dragStartPos) {
            var dx = Math.abs(pos.x - dragStartPos.x);
            var dy = Math.abs(pos.y - dragStartPos.y);
            if (dx > 8 || dy > 8) {
                isTouchDragging = true;
            }
        }
        // Get the touch angle (same logic as mouse)
        var touchangle = radToDeg(Math.atan2((player.y+level.tileheight/2) - pos.y, pos.x - (player.x+level.tilewidth/2)));
        if (touchangle < 0) {
            touchangle = 180 + (180 + touchangle);
        }
        var lbound = 8;
        var ubound = 172;
        if (touchangle > 90 && touchangle < 270) {
            if (touchangle > ubound) touchangle = ubound;
        } else {
            if (touchangle < lbound || touchangle >= 270) touchangle = lbound;
        }
        player.angle = touchangle;
    }

    function onTouchStart(e) {
        e.preventDefault();
        var pos = getTouchPos(canvas, e);
        dragStartPos = pos;
        isTouchDragging = false;
        // Update angle on touch start
        var touchangle = radToDeg(Math.atan2((player.y+level.tileheight/2) - pos.y, pos.x - (player.x+level.tilewidth/2)));
        if (touchangle < 0) {
            touchangle = 180 + (180 + touchangle);
        }
        var lbound = 8;
        var ubound = 172;
        if (touchangle > 90 && touchangle < 270) {
            if (touchangle > ubound) touchangle = ubound;
        } else {
            if (touchangle < lbound || touchangle >= 270) touchangle = lbound;
        }
        player.angle = touchangle;
    }

    function onTouchEnd(e) {
        e.preventDefault();
        // Only shoot if a drag occurred
        if (gamestate == gamestates.ready && isTouchDragging) {
            shootBubble();
        } else if (gamestate == gamestates.gameover) {
            newGame();
        }
        dragStartPos = null;
        isTouchDragging = false;
    }

    // Pause/Resume button logic
    if (pauseBtn && pausedOverlay && resumeBtn) {
        pauseBtn.onclick = function() {
            isPaused = true;
            pausedOverlay.style.display = "flex";
            pauseBtn.style.display = "none";
        };
        resumeBtn.onclick = function() {
            isPaused = false;
            pausedOverlay.style.display = "none";
            pauseBtn.style.display = "inline-block";
        };
    }

    // SVGs for sound on/off
    var soundOnSVG = '<svg id="sound-on-svg" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" style="display:block; color:#3b59ff;"><path d="M20.522 7.228a6.74 6.74 0 0 1 0 9.544M7.5 15.75H3a.75.75 0 0 1-.75-.75V9A.75.75 0 0 1 3 8.25h4.5L14.25 3v18L7.5 15.75Zm0-7.5v7.5m10.369-5.869a2.99 2.99 0 0 1 0 4.238" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
    var soundOffSVG = '<svg id="sound-off-svg" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="28" height="28" style="display:block; color:#3b59ff;"><path d="M27.363 9.637a8.988 8.988 0 0 1 0 12.726M10 11v10m13.825-7.825a3.99 3.99 0 0 1 0 5.65M6 5l20 22m-7-7.7V28l-9-7H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h6l.85-.662m3.175-2.463L19 4v9.35" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

    // Sound on/off button logic
    if (soundBtn && soundIcon) {
        soundBtn.onclick = function() {
            soundEnabled = !soundEnabled;
            soundIcon.innerHTML = soundEnabled ? soundOnSVG : soundOffSVG;
        };
        // Ensure initial icon is correct
        soundIcon.innerHTML = soundEnabled ? soundOnSVG : soundOffSVG;
    }

    // Call init to start the game
    init();
};