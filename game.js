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

// Scene setup with improved visuals
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x87CEEB);
const horizonColor = new THREE.Color(0xAFDFEF);
scene.background = skyColor;

// Create dynamic fog that adjusts with difficulty and time
scene.fog = new THREE.Fog(horizonColor, 80, 250);

// Camera setup with better defaults for downhill view
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 20);
camera.lookAt(0, 0, -10);

// Renderer setup with improved shadows
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.physicallyCorrectLights = true;
renderer.toneMappingExposure = 1.0;
document.getElementById('game-container').appendChild(renderer.domElement);

// Enhanced lighting for better visuals
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(50, 200, 100);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 50;
directionalLight.shadow.camera.far = 300;
directionalLight.shadow.camera.left = -100;
directionalLight.shadow.camera.right = 100;
directionalLight.shadow.camera.top = 100;
directionalLight.shadow.camera.bottom = -100;
scene.add(directionalLight);

// Add hemisphere light for better environment lighting
const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x444422, 0.5);
scene.add(hemisphereLight);

// Physics world with improved parameters for better rolling
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -20, 0)
});

// Set up contact material handling for better physics
const defaultMaterial = new CANNON.Material('default');
const ballMaterial = new CANNON.Material('ball');

const ballDefaultContactMaterial = new CANNON.ContactMaterial(
    defaultMaterial,
    ballMaterial,
    {
        friction: 0.3,
        restitution: 0.7,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
    }
);

world.addContactMaterial(ballDefaultContactMaterial);

// Player ball with enhanced details
const { ballMesh, ballBody, particles } = createBall();
scene.add(ballMesh);
scene.add(particles);
world.addBody(ballBody);

// Reset ball position to properly align with the downhill slope
ballBody.position.set(0, 5, 0);

// Track segments with improved handling
const trackSegments = [];
const trackSegmentLength = 100;
const numInitialSegments = 5;

// Impact particles system for collisions
const impactGeometry = new THREE.BufferGeometry();
const impactPositions = new Float32Array(100 * 3); // 100 particles
impactGeometry.setAttribute('position', new THREE.BufferAttribute(impactPositions, 3));

const impactMaterial = new THREE.PointsMaterial({
    color: 0xffffaa,
    size: 0.5,
    transparent: true,
    opacity: 0.8
});

const impactParticles = new THREE.Points(impactGeometry, impactMaterial);
impactParticles.visible = false;
scene.add(impactParticles);

let impactParticleVelocities = [];
let impactActive = false;

// Initial track generation with improved segments that are properly aligned
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

// Improved camera follow system with better downhill view
function updateCamera() {
    // Dynamic camera positioning based on speed
    const speed = Math.abs(ballBody.velocity.z);
    const speedFactor = Math.min(1, speed / 30);
    
    // Base offset (when still) - improved to see more downhill
    let offsetY = 12;
    let offsetZ = 15;
    
    // Adjust for speed (lower and further back at high speeds)
    offsetY = offsetY - speedFactor * 5;
    offsetZ = offsetZ + speedFactor * 15;
    
    // Create smooth camera movement
    const idealOffset = new THREE.Vector3(0, offsetY, offsetZ);
    const idealLookAt = new THREE.Vector3(0, 2, -30); // Look further down the slope
    
    const ballPosition = new THREE.Vector3(
        ballBody.position.x,
        ballBody.position.y,
        ballBody.position.z
    );
    
    // Smoothly move camera (lerp)
    const currentPosition = new THREE.Vector3();
    currentPosition.copy(camera.position);
    currentPosition.lerp(ballPosition.clone().add(idealOffset), 0.1);
    camera.position.copy(currentPosition);
    
    // Look at ball with slight forward bias
    const targetLookAt = ballPosition.clone().add(idealLookAt);
    camera.lookAt(targetLookAt);
}

// Function to create impact effect
function createImpact(position, intensity) {
    impactParticles.visible = true;
    impactActive = true;
    
    // Reset particles
    impactParticleVelocities = [];
    
    // Create explosion effect
    for (let i = 0; i < 100; i++) {
        // Random position near the impact
        impactPositions[i * 3] = position.x + (Math.random() - 0.5) * 0.5;
        impactPositions[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.5;
        impactPositions[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.5;
        
        // Random velocity for each particle
        impactParticleVelocities.push({
            x: (Math.random() - 0.5) * 10 * intensity,
            y: Math.random() * 10 * intensity, // Mostly up
            z: (Math.random() - 0.5) * 10 * intensity
        });
    }
    
    impactParticles.geometry.attributes.position.needsUpdate = true;
}

// Update impact particles
function updateImpact(delta) {
    if (!impactActive) return;
    
    let stillActive = false;
    
    for (let i = 0; i < 100; i++) {
        // Apply gravity and update positions
        impactParticleVelocities[i].y -= 20 * delta; // Gravity
        
        impactPositions[i * 3] += impactParticleVelocities[i].x * delta;
        impactPositions[i * 3 + 1] += impactParticleVelocities[i].y * delta;
        impactPositions[i * 3 + 2] += impactParticleVelocities[i].z * delta;
        
        // If any particle is still above ground, effect is still active
        if (impactPositions[i * 3 + 1] > 0) {
            stillActive = true;
        }
    }
    
    impactParticles.geometry.attributes.position.needsUpdate = true;
    
    // Deactivate once all particles hit the ground
    if (!stillActive) {
        impactActive = false;
        impactParticles.visible = false;
    }
}

// Game loop
const clock = new THREE.Clock();
let lastTime = 0;

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.started || gameState.gameOver) {
        renderer.render(scene, camera);
        return;
    }
    
    const delta = clock.getDelta();
    
    // Update physics
    world.step(1/60, delta, 3);
    
    // Update ball mesh to match physics body
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    
    // Update particle trail
    updateBallTrail(particles, ballBody.position, ballBody.velocity);
    
    // Check for impact events
    if (ballBody.onImpact) {
        createImpact(ballBody.onImpact.position, ballBody.onImpact.intensity);
        ballBody.onImpact = null; // Clear impact
    }
    
    // Update impact particles
    updateImpact(delta);
    
    // Enhanced ball movement controls
    const moveForce = 15 * (1 + gameState.difficulty * 0.5);
    if (keys.left) ballBody.applyForce(new CANNON.Vec3(-moveForce, 0, 0), ballBody.position);
    if (keys.right) ballBody.applyForce(new CANNON.Vec3(moveForce, 0, 0), ballBody.position);
    
    // Forward/backward control
    if (keys.forward) ballBody.applyForce(new CANNON.Vec3(0, 0, -moveForce * 1.5), ballBody.position);
    if (keys.backward) ballBody.applyForce(new CANNON.Vec3(0, 0, moveForce * 0.8), ballBody.position);
    
    // Jump control when on ground
    if (keys.jump && Math.abs(ballBody.velocity.y) < 0.5) {
        ballBody.applyImpulse(new CANNON.Vec3(0, moveForce * 2, 0), ballBody.position);
    }
    
    // Apply automatic forward force (less when going fast) - enhanced for better downhill feel
    const currentSpeed = Math.abs(ballBody.velocity.z);
    const forwardForce = 7 * Math.max(0.5, (1 - currentSpeed/40)) * gameState.difficulty;
    ballBody.applyForce(new CANNON.Vec3(0, 0, -forwardForce), ballBody.position);
    
    // Update camera
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
    
    // Track regeneration
    if (ballBody.position.z < trackSegments[trackSegments.length - 1].endZ + trackSegmentLength) {
        const lastSegment = trackSegments[trackSegments.length - 1];
        const newSegment = generateTrackSegment(
            lastSegment.endZ, 
            lastSegment.endZ - trackSegmentLength, 
            gameState.difficulty
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
        
        // Remove old segments
        if (trackSegments.length > numInitialSegments + 3) {
            const oldSegment = trackSegments.shift();
            scene.remove(oldSegment.visual);
            world.removeBody(oldSegment.body);
            
            // Remove obstacle bodies
            if (oldSegment.obstacles) {
                oldSegment.obstacles.forEach(obstacle => {
                    scene.remove(obstacle.mesh);
                    world.removeBody(obstacle.body);
                });
            }
        }
    }
    
    // Update fog color based on difficulty to create mood changes
    const fogHue = 0.6 - Math.min(0.1, gameState.difficulty * 0.01);
    scene.fog.color.setHSL(fogHue, 0.5, 0.8);
    
    // Calculate score and speed
    gameState.score = Math.floor(Math.abs(ballBody.position.z));
    document.getElementById('score-value').textContent = gameState.score;
    
    const ballVelocity = Math.sqrt(
        ballBody.velocity.x * ballBody.velocity.x +
        ballBody.velocity.z * ballBody.velocity.z
    );
    gameState.speed = Math.floor(ballVelocity * 3.6); // m/s to km/h
    document.getElementById('speed-value').textContent = gameState.speed;
    
    // Increase difficulty progressively
    gameState.difficulty = 1 + Math.floor(gameState.score / 500) * 0.2;
    
    // Check for game over
    if (ballBody.position.y < -10) {
        gameOver();
    }
    
    renderer.render(scene, camera);
}

function gameOver() {
    gameState.gameOver = true;
    document.getElementById('game-over').classList.remove('hidden');
    document.getElementById('final-score').textContent = gameState.score;
}

function startGame() {
    // Reset ball position with better initial height to ensure proper placement on track
    ballBody.position.set(0, 5, 0);
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