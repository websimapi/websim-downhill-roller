import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function createBall() {
    const radius = 1;
    const segments = 36; // Increased for smoother sphere
    
    // Create a more visually distinctive ball
    const ballGroup = new THREE.Group();
    
    // Create main sphere with improved material
    const geometry = new THREE.SphereGeometry(radius, segments, segments);
    
    // Create material with enhanced properties
    const material = new THREE.MeshStandardMaterial({
        color: 0xff2200, // Brighter orange-red
        roughness: 0.3,
        metalness: 0.7,
        envMapIntensity: 1.0
    });
    
    // Add detailed bump patterns
    const bumpCount = 32; // More bumps
    const bumpSize = 0.15; // Larger bumps
    const bumpGeometry = new THREE.SphereGeometry(bumpSize, 8, 8);
    const bumpMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800, // Brighter accent color
        roughness: 0.4,
        metalness: 0.6,
        emissive: 0xff4400,
        emissiveIntensity: 0.2 // Subtle glow
    });
    
    const ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    ballGroup.add(ballMesh);
    
    // Add more prominent bumps in a better pattern
    for (let i = 0; i < bumpCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / bumpCount);
        const theta = Math.sqrt(bumpCount * Math.PI) * phi;
        
        const bumpMesh = new THREE.Mesh(bumpGeometry, bumpMaterial);
        
        // Position on sphere
        const x = Math.sin(phi) * Math.cos(theta) * radius;
        const y = Math.sin(phi) * Math.sin(theta) * radius;
        const z = Math.cos(phi) * radius;
        
        bumpMesh.position.set(x, y, z);
        // Point the bump outward from center of sphere
        bumpMesh.lookAt(0, 0, 0);
        bumpMesh.castShadow = true;
        
        ballGroup.add(bumpMesh);
    }
    
    // Add glowing effect for speed indication
    const glowGeometry = new THREE.SphereGeometry(radius * 1.2, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.15
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    glowMesh.visible = false; // Only visible at high speeds
    ballGroup.add(glowMesh);
    
    // Enhanced particle system for better trail effect
    const particleCount = 100; // More particles
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        // Initial positions (will be updated in game loop)
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        
        // Orange to yellow to red colors for particles
        const colorFactor = i / particleCount;
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.7 - colorFactor * 0.7;
        colors[i * 3 + 2] = colorFactor * 0.3;
        
        // Varied sizes, bigger at the start of trail
        sizes[i] = 0.4 * (1 - (i / particleCount) * 0.7);
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.visible = false; // Start hidden, show when needed
    
    // Improved physics body with better properties
    const ballShape = new CANNON.Sphere(radius);
    const ballBody = new CANNON.Body({
        mass: 5,
        shape: ballShape,
        position: new CANNON.Vec3(0, 5, 0), // Higher starting position
        linearDamping: 0.05, // Less damping for longer rolls
        angularDamping: 0.1,
        allowSleep: false
    });
    
    // Add better surface properties for more responsive rolling
    ballBody.material = new CANNON.Material({
        friction: 0.8,
        restitution: 0.4
    });
    
    // Add contact event detection
    ballBody.addEventListener('collide', (event) => {
        const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
        
        // Create impact on more collisions
        if (Math.abs(relativeVelocity) > 3) {
            // This will be used in game.js to create impact effects
            ballBody.onImpact = {
                position: new CANNON.Vec3().copy(event.contact.bi.position),
                intensity: Math.min(1.0, Math.abs(relativeVelocity) / 15)
            };
        }
    });
    
    return { 
        ballMesh: ballGroup, 
        ballBody,
        particles,
        glowMesh
    };
}

// Improved function to update particle trail
export function updateBallTrail(particles, ballPosition, ballVelocity, glowMesh) {
    const positions = particles.geometry.attributes.position.array;
    const speed = Math.sqrt(
        ballVelocity.x * ballVelocity.x + 
        ballVelocity.y * ballVelocity.y + 
        ballVelocity.z * ballVelocity.z
    );
    
    // Update glow effect based on speed
    if (glowMesh) {
        const speedFactor = Math.min(1, speed / 40);
        glowMesh.visible = speed > 15;
        
        if (glowMesh.visible) {
            glowMesh.material.opacity = 0.1 + speedFactor * 0.3;
            glowMesh.scale.set(
                1 + speedFactor * 0.3,
                1 + speedFactor * 0.3,
                1 + speedFactor * 0.3
            );
        }
    }
    
    // Only show particles when moving fast enough
    particles.visible = speed > 8;
    
    if (!particles.visible) return;
    
    // Update particle positions with improved trail dynamics
    for (let i = particles.geometry.attributes.position.count - 1; i > 0; i--) {
        // Move particles back in the array (create trailing effect)
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
    }
    
    // Add new particle at ball position with dynamic offset based on velocity
    const velMag = Math.min(1, speed / 30);
    const spreadFactor = 0.3 + velMag * 0.5;
    
    positions[0] = ballPosition.x + (Math.random() - 0.5) * spreadFactor;
    positions[1] = ballPosition.y - radius * 0.7 + (Math.random() - 0.5) * spreadFactor;
    positions[2] = ballPosition.z + (Math.random() - 0.5) * spreadFactor;
    
    // Update opacity based on speed
    particles.material.opacity = 0.5 + velMag * 0.5;
    
    particles.geometry.attributes.position.needsUpdate = true;
}