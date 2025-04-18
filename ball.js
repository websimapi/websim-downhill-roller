import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function createBall() {
    const radius = 1;
    const segments = 32;
    
    // Create a more detailed ball with material properties
    const ballGroup = new THREE.Group();
    
    // Create main sphere with texture
    const geometry = new THREE.SphereGeometry(radius, segments, segments);
    
    // Create material with texture
    const material = new THREE.MeshStandardMaterial({
        color: 0xff4500,
        roughness: 0.4,
        metalness: 0.6,
        envMapIntensity: 0.8
    });
    
    // Add bump details to the sphere
    const bumpCount = 24;
    const bumpSize = 0.1;
    const bumpGeometry = new THREE.SphereGeometry(bumpSize, 8, 8);
    const bumpMaterial = new THREE.MeshStandardMaterial({
        color: 0xdd3300,
        roughness: 0.6,
        metalness: 0.3
    });
    
    const ballMesh = new THREE.Mesh(geometry, material);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    ballGroup.add(ballMesh);
    
    // Add bumps in a pattern around the sphere
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
    
    // Create particle system for trail effect
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
        // Initial positions (will be updated in game loop)
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        
        // Orange to yellow colors for particles
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 0.5 - (i / particleCount) * 0.5;
        colors[i * 3 + 2] = 0;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.8
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.visible = false; // Start hidden, show when needed
    
    // Physics body with more realistic properties
    const ballShape = new CANNON.Sphere(radius);
    const ballBody = new CANNON.Body({
        mass: 5,
        shape: ballShape,
        position: new CANNON.Vec3(0, 5, 0),
        linearDamping: 0.1,
        angularDamping: 0.1,
        allowSleep: false
    });
    
    // Add surface properties for better rolling
    ballBody.material = new CANNON.Material({
        friction: 0.7,
        restitution: 0.3
    });
    
    // Add contact event detection
    ballBody.addEventListener('collide', (event) => {
        const relativeVelocity = event.contact.getImpactVelocityAlongNormal();
        
        // Only create impact on significant collisions
        if (Math.abs(relativeVelocity) > 5) {
            // This will be used in game.js to create impact effects
            ballBody.onImpact = {
                position: new CANNON.Vec3().copy(event.contact.bi.position),
                intensity: Math.min(1.0, Math.abs(relativeVelocity) / 20)
            };
        }
    });
    
    return { 
        ballMesh: ballGroup, 
        ballBody,
        particles
    };
}

// Function to update particle trail
export function updateBallTrail(particles, ballPosition, ballVelocity) {
    const positions = particles.geometry.attributes.position.array;
    const speed = Math.sqrt(
        ballVelocity.x * ballVelocity.x + 
        ballVelocity.y * ballVelocity.y + 
        ballVelocity.z * ballVelocity.z
    );
    
    // Only show particles when moving fast enough
    particles.visible = speed > 10;
    
    if (!particles.visible) return;
    
    // Update particle positions
    for (let i = particles.geometry.attributes.position.count - 1; i > 0; i--) {
        // Move particles back in the array (create trailing effect)
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
    }
    
    // Add new particle at ball position with small random offset
    positions[0] = ballPosition.x + (Math.random() - 0.5) * 0.3;
    positions[1] = ballPosition.y - 1 * 0.7 + (Math.random() - 0.5) * 0.3;
    positions[2] = ballPosition.z + (Math.random() - 0.5) * 0.3;
    
    particles.geometry.attributes.position.needsUpdate = true;
}