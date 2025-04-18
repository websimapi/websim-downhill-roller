import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { generateTrackSegment } from './track.js';
import { createBall, updateBallTrail } from './ball.js';

// Game state
let gameState = {
    started: false,
    gameOver: false,
    score: 0,
    speed: 0,
    difficulty: 1
};

// Scene setup with enhanced visuals
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x88CEFA); // Brighter blue sky
scene.background = skyColor;

// Create dynamic fog that changes color with elevation and speed
scene.fog = new THREE.Fog(skyColor, 60, 400);

// Camera setup with improved downhill view
const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 25);
camera.lookAt(0, 0, -20);

// Renderer setup with enhanced shadows and effects
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMappingExposure = 1.2; // Brighter rendering
document.getElementById('game-container').appendChild(renderer.domElement);

// Improved lighting for better terrain visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Brighter ambient
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffcc, 1.0); // Warmer and brighter sunlight
directionalLight.position.set(60, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 50;
directionalLight.shadow.camera.far = 500; // Increased shadow distance
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
scene.add(directionalLight);

// Add hemisphere light for better environment lighting
const hemisphereLight = new THREE.HemisphereLight(0x88CEFA, 0x553311, 0.7); // Sky to ground colors
scene.add(hemisphereLight);

// Add subtle directional rim light for better edge definition
const rimLight = new THREE.DirectionalLight(0xffffdd, 0.3);
rimLight.position.set(-50, 50, -100);
scene.add(rimLight);

// Physics world with improved parameters for better rolling
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -25, 0) // Increased gravity for faster downhill
});

// Set up contact material handling for better physics
const defaultMaterial = new CANNON.Material('default');
const ballMaterial = new CANNON.Material('ball');

const ballDefaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    ballMaterial,
    {
        friction: 0.4,
        restitution: 0.6,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
    }
);

world.addContactMaterial(ballDefaultContactMaterial);

// Player ball with enhanced details
const { ballMesh, ballBody, particles, glowMesh } = createBall();
scene.add(ballMesh);
scene.add(particles);
world.addBody(ballBody);

// Reset ball position to properly align with the downhill slope
ballBody.position.set(0, 8, 0); // Higher starting position for better visibility

// Track segments with improved handling
const trackSegments = [];
const trackSegmentLength = 120; // Longer segments for better performance
const numInitialSegments = 5;

// Impact particles system with improved effects
const impactGeometry = new THREE.BufferGeometry();
const impactPositions = new Float32Array(150 * 3); // More particles
const impactColors = new Float32Array(150 * 3); // Add colors
impactGeometry.setAttribute('position', new THREE.BufferAttribute(impactPositions, 3));
impactGeometry.setAttribute('color', new THREE.BufferAttribute(impactColors, 3));

const impactMaterial = new THREE.PointsMaterial({
    size: 0.7,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending
});

const impactParticles = new THREE.Points(impactGeometry, impactMaterial);
impactParticles.visible = false;
scene.add(impactParticles);

let impactParticleVelocities = [];
let impactActive = false;

// Initial track generation with improved segments
for (let i = 0; i < numInitialSegments; i++) {
    const segment = generateTrackSegment(
        -i * trackSegmentLength, 
        -(i + 1) * trackSegmentLength, 
        gameState.difficulty
    );
    trackSegments.push(segment);
    scene.add(segment.visual);
    world.addBody(segment.body);
    
    // Add obstacle bodies
    if (segment.obstacles) {
        segment.obstacles.forEach(obstacle => {
            world.addBody(obstacle.body);
        });
    }
}

// Controls
const keys = {
    left: false,
    right: false,
    forward: false,
    backward: false,
    jump: false
};

document.addEventListener('keydown', (e) => {
    if (gameState.started && !gameState.gameOver) {
        if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
        if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;
        if (e.key === 'w' || e.key === 'ArrowUp') keys.forward = true;
        if (e.key === 's' || e.key === 'ArrowDown') keys.backward = true;
        if (e.key === ' ') keys.jump = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'w' || e.key === 'ArrowUp') keys.forward = false;
    if (e.key === 's' || e.key === 'ArrowDown') keys.backward = false;
    if (e.key === ' ') keys.jump = false;
});

// Mobile touch controls
let touchStartX = 0;
document.addEventListener('touchstart', (e) => {
    if (gameState.started && !gameState.gameOver) {
        touchStartX = e.touches[0].clientX;
    }
});

document.addEventListener('touchmove', (e) => {
    if (gameState.started && !gameState.gameOver) {
        const touchX = e.touches[0].clientX;
        if (touchX < touchStartX - 20) keys.left = true;
        else if (touchX > touchStartX + 20) keys.right = true;
        else {
            keys.left = false;
            keys.right = false;
        }
    }
});

document.addEventListener('touchend', () => {
    keys.left = false;
    keys.right = false;
});

// Dramatically improved camera follow system
function updateCamera() {
    // Dynamic camera positioning based on speed
    const speed = Math.abs(ballBody.velocity.z);
    const speedFactor = Math.min(1, speed / 40);
    
    // Base offset (when still)
    let offsetY = 14 - speedFactor * 5; // Lower at high speeds
    let offsetZ = 18 + speedFactor * 20; // Further back at high speeds
    
    // Add dynamic camera tilt based on terrain and speed
    const tiltFactor = Math.min(1, speed / 30) * 0.15;
    const idealOffset = new THREE.Vector3(
        ballBody.velocity.x * 0.3, // Slight shift in direction of horizontal movement
        offsetY,
        offsetZ
    );
    
    // Look ahead further on steep downhill sections and higher speeds
    const lookAheadDistance = 20 + speedFactor * 40;
    const idealLookAt = new THREE.Vector3(
        ballBody.velocity.x * 0.5, // Look in direction of horizontal movement
        -2 - speedFactor * 3, // Look further down at high speeds
        -lookAheadDistance // Look ahead of the ball
    );
    
    const ballPosition = new THREE.Vector3(
        ballBody.position.x,
        ballBody.position.y,
        ballBody.position.z
    );
    
    // Add camera shake on high speeds or impacts
    if (speed > 30 || ballBody.onImpact) {
        const shakeMagnitude = ballBody.onImpact ? 
            Math.min(0.3, ballBody.onImpact.intensity * 0.3) : 
            Math.min(0.1, (speed - 30) / 50);
            
        idealOffset.x += (Math.random() - 0.5) * shakeMagnitude;
        idealOffset.y += (Math.random() - 0.5) * shakeMagnitude;
        idealOffset.z += (Math.random() - 0.5) * shakeMagnitude;
    }
    
    // Smoothly move camera with variable smoothing based on speed
    // Faster movement at high speeds for more responsive feel
    const smoothing = 0.1 + speedFactor * 0.05;
    const currentPosition = new THREE.Vector3();
    currentPosition.copy(camera.position);
    currentPosition.lerp(ballPosition.clone().add(idealOffset), smoothing);
    camera.position.copy(currentPosition);
    
    // Look at target with lead
    const targetLookAt = ballPosition.clone().add(idealLookAt);
    camera.lookAt(targetLookAt);
    
    // Adjust field of view based on speed for sense of speed
    camera.fov = 75 + speedFactor * 15;
    camera.updateProjectionMatrix();
}

// Enhanced impact effect with more dynamic particles
function createImpact(position, intensity) {
    impactParticles.visible = true;
    impactActive = true;
    
    // Reset particles
    impactParticleVelocities = [];
    
    // Create explosion effect with varied colors
    for (let i = 0; i < 150; i++) {
        // Random position near the impact
        impactPositions[i * 3] = position.x + (Math.random() - 0.5) * 0.5;
        impactPositions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.5;
        impactPositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
        
        // Random velocity for each particle
        impactParticleVelocities.push({
            x: (Math.random() - 0.5) * 15 * intensity,
            y: (Math.random() * 10 + 5) * intensity, // Mostly up
            z: (Math.random() - 0.5) * 15 * intensity
        });
        
        // Set colors - orange/yellow/red for impacts
        const colorVariation = Math.random();
        impactColors[i * 3] = 1.0; // Red
        impactColors[i * 3 + 1] = 0.3 + colorVariation * 0.7; // Variable yellow
        impactColors[i * 3 + 2] = 0.1 * colorVariation; // Low blue
    }
    
    impactParticles.geometry.attributes.position.needsUpdate = true;
    impactParticles.geometry.attributes.color.needsUpdate = true;
}

// Update impact particles with better physics
function updateImpact(delta) {
    if (!impactActive) return;
    
    let stillActive = false;
    
    for (let i = 0; i < 150; i++) {
        // Apply gravity and update positions
        impactParticleVelocities[i].y -= 30 * delta; // Stronger gravity
        
        impactPositions[i * 3] += impactParticleVelocities[i].x * delta;
        impactPositions[i * 3 + 1] += impactParticleVelocities[i].y * delta;
        impactPositions[i * 3 + 2] += impactParticleVelocities[i].z * delta;
        
        // Fade out particles over time
        const particleLife = impactPositions[i * 3 + 1] / 10 + 0.5; // Height-based fade
        impactColors[i * 3 + 1] *= 0.98; // Yellow fades faster
        
        // If any particle is still active
        if (impactPositions[i * 3 + 1] > 0 && particleLife > 0.1) {
            stillActive = true;
        }
    }
    
    impactParticles.geometry.attributes.position.needsUpdate = true;
    impactParticles.geometry.attributes.color.needsUpdate = true;
    
    // Deactivate once particles fade out
    if (!stillActive) {
        impactActive = false;
        impactParticles.visible = false;
    }
}

// Enhanced game loop
const clock = new THREE.Clock();
let lastTime = 0;

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.started || gameState.gameOver) {
        // Add subtle rotation to the ball on the menu screen
        if (!gameState.started) {
            ballMesh.rotation.y += 0.01;
            renderer.render(scene, camera);
        }
        return;
    }
    
    const delta = clock.getDelta();
    
    // Update physics with better precision
    const substeps = 2; // More substeps for stable physics
    const timeStep = delta / substeps;
    for (let i = 0; i < substeps; i++) {
        world.step(1/60, timeStep, 3);
    }
    
    // Update ball mesh to match physics body
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    
    // Update particle trail with enhanced effects
    updateBallTrail(particles, ballBody.position, ballBody.velocity, glowMesh);
    
    // Check for impact events
    if (ballBody.onImpact) {
        createImpact(ballBody.onImpact.position, ballBody.onImpact.intensity);
        ballBody.onImpact = null; // Clear impact
    }
    
    // Update impact particles
    updateImpact(delta);
    
    // Enhanced ball movement with better control and responsiveness
    const moveForce = 25 * (1 + gameState.difficulty * 0.3);
    
    // Calculate current speed for force scaling
    const currentSpeed = Math.sqrt(
        ballBody.velocity.x * ballBody.velocity.x +
        ballBody.velocity.z * ballBody.velocity.z
    );
    
    // Scale forces inversely with speed for better control
    const speedScalingFactor = Math.max(0.4, 1 - currentSpeed / 60);
    
    if (keys.left) {
        // Apply more force when moving slowly, less when fast
        const leftForce = moveForce * speedScalingFactor;
        ballBody.applyForce(new CANNON.Vec3(-leftForce, 0, 0), ballBody.position);
    }
    
    if (keys.right) {
        const rightForce = moveForce * speedScalingFactor;
        ballBody.applyForce(new CANNON.Vec3(rightForce, 0, 0), ballBody.position);
    }
    
    // Forward/backward control with improved scaling
    if (keys.forward) {
        const fwdForce = moveForce * 1.2 * speedScalingFactor;
        ballBody.applyForce(new CANNON.Vec3(0, 0, -fwdForce), ballBody.position);
    }
    
    if (keys.backward) {
        const backForce = moveForce * 0.8 * speedScalingFactor;
        ballBody.applyForce(new CANNON.Vec3(0, 0, backForce), ballBody.position);
    }
    
    // Jump control when on ground with better detection
    if (keys.jump) {
        // Check if ball is on or near ground
        let onGround = false;
        const rayStart = new CANNON.Vec3(ballBody.position.x, ballBody.position.y, ballBody.position.z);
        const rayEnd = new CANNON.Vec3(ballBody.position.x, ballBody.position.y - 1.3, ballBody.position.z);
        const rayCastResult = new CANNON.RaycastResult();
        world.raycastClosest(rayStart, rayEnd, {}, rayCastResult);
        
        if (rayCastResult.hasHit || Math.abs(ballBody.velocity.y) < 0.5) {
            onGround = true;
        }
        
        if (onGround) {
            ballBody.applyImpulse(new CANNON.Vec3(0, moveForce * 1.5, 0), ballBody.position);
        }
    }
    
    // Apply automatic forward force that scales with difficulty
    // Less force when going fast, more on steep sections
    const forwardFactor = Math.max(0.6, (1 - currentSpeed/50));
    const baseDifficulty = 1 + gameState.difficulty * 0.2;
    const forwardForce = 12 * forwardFactor * baseDifficulty;
    
    // Apply forward force in the direction of the slope, not just along Z
    // This provides better acceleration on steep sections
    ballBody.applyForce(new CANNON.Vec3(0, -forwardForce * 0.3, -forwardForce), ballBody.position);
    
    // Update camera with improved follow system
    updateCamera();
    
    // Update obstacles
    trackSegments.forEach(segment => {
        if (segment.obstacles) {
            segment.obstacles.forEach(obstacle => {
                obstacle.mesh.position.copy(obstacle.body.position);
                obstacle.mesh.quaternion.copy(obstacle.body.quaternion);
            });
        }
    });
    
    // Enhanced track regeneration based on player position
    // Generate track further ahead to prevent pop-in at high speeds
    const lookAheadDistance = 50 + Math.min(150, currentSpeed * 4);
    if (ballBody.position.z < trackSegments[trackSegments.length - 1].endZ + lookAheadDistance) {
        const lastSegment = trackSegments[trackSegments.length - 1];
        
        // Calculate increasing difficulty based on distance traveled
        const distanceDifficulty = 1 + Math.floor(Math.abs(ballBody.position.z) / 500) * 0.25;
        const newDifficulty = Math.min(3.0, distanceDifficulty);
        
        const newSegment = generateTrackSegment(
            lastSegment.endZ, 
            lastSegment.endZ - trackSegmentLength, 
            newDifficulty
        );
        trackSegments.push(newSegment);
        scene.add(newSegment.visual);
        world.addBody(newSegment.body);
        
        // Add obstacle bodies
        if (newSegment.obstacles) {
            newSegment.obstacles.forEach(obstacle => {
                world.addBody(obstacle.body);
            });
        }
        
        // Remove old segments with better memory management
        if (trackSegments.length > numInitialSegments + 2) {
            const oldSegment = trackSegments.shift();
            scene.remove(oldSegment.visual);
            world.removeBody(oldSegment.body);
            
            // Clean up obstacle bodies
            if (oldSegment.obstacles) {
                oldSegment.obstacles.forEach(obstacle => {
                    scene.remove(obstacle.mesh);
                    world.removeBody(obstacle.body);
                });
            }
            
            // Force garbage collection on large objects
            if (oldSegment.visual.geometry) {
                oldSegment.visual.geometry.dispose();
            }
            if (oldSegment.visual.material) {
                if (Array.isArray(oldSegment.visual.material)) {
                    oldSegment.visual.material.forEach(m => m.dispose());
                } else {
                    oldSegment.visual.material.dispose();
                }
            }
        }
    }
    
    // Update fog color and distance based on speed and difficulty
    // Creates atmospheric effects for better downhill experience
    const fogHue = 0.6 - Math.min(0.15, gameState.difficulty * 0.05);
    const fogSaturation = 0.5 - speedFactor * 0.2;
    const fogLightness = 0.8 - speedFactor * 0.1;
    
    scene.fog.color.setHSL(fogHue, fogSaturation, fogLightness);
    scene.fog.near = 60 + speedFactor * 30; // Fog starts further away at high speeds
    scene.fog.far = 300 + speedFactor * 200; // Extends further at high speeds
    
    // Calculate score and speed with smoothing
    gameState.score = Math.floor(Math.abs(ballBody.position.z));
    document.getElementById('score-value').textContent = gameState.score;
    
    const ballVelocity = Math.sqrt(
        ballBody.velocity.x * ballBody.velocity.x +
        ballBody.velocity.z * ballBody.velocity.z
    );
    gameState.speed = Math.floor(ballVelocity * 3.6); // m/s to km/h
    document.getElementById('speed-value').textContent = gameState.speed;
    
    // Increase difficulty progressively for more challenge
    gameState.difficulty = 1 + Math.floor(gameState.score / 400) * 0.2;
    
    // Check for game over - falling off track or hitting terrain
    if (ballBody.position.y < -15) {
        gameOver();
    }
    
    renderer.render(scene, camera);
}

// Game over screen
function gameOver() {
    gameState.gameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-score').textContent = gameState.score;
}

// Start game function
function startGame() {
    // Reset ball position with better initial height to ensure proper placement on track
    ballBody.position.set(0, 8, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    
    // Reset game state
    gameState.started = true;
    gameState.gameOver = false;
    gameState.score = 0;
    gameState.speed = 0;
    gameState.difficulty = 1;
    
    // Hide UI elements
    document.getElementById('instructions').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    
    // Start animation if not already running
    if (!clock.running) {
        clock.start();
        animate();
    }
}

// Event listeners for buttons
document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('restart-button').addEventListener('click', startGame);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial render
renderer.render(scene, camera);