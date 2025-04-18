import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function generateTrackSegment(startZ, endZ, difficulty) {
    const segmentLength = Math.abs(endZ - startZ);
    const segmentWidth = 20;
    
    // Create track visual
    const trackGroup = new THREE.Group();
    
    // Use heightmap for terrain
    const resolution = 64;
    const noise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(
        segmentWidth + 20, 
        segmentLength, 
        resolution, 
        resolution
    );
    
    // Apply noise to vertices to create terrain bumps
    const terrainHeightMap = [];
    const terrainWidthPoints = resolution + 1;
    const terrainLengthPoints = resolution + 1;
    
    // Generate heightmap
    for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
        const x = terrainGeometry.attributes.position.getX(i);
        const z = terrainGeometry.attributes.position.getZ(i);
        
        // Keep track path fairly flat but bumpy at higher difficulties
        let y = 0;
        
        // More intense bumps off to the sides
        const distFromCenter = Math.abs(x);
        
        if (distFromCenter < segmentWidth/2 - 2) {
            // Main track area - slightly bumpy at higher difficulties
            y = noise.noise(x * 0.1, z * 0.1) * 0.5 * difficulty;
        } else if (distFromCenter < segmentWidth/2 + 5) {
            // Side areas - more bumpy
            y = noise.noise(x * 0.2, z * 0.1) * 2 * difficulty;
            
            // Create a ditch at the edge of the main track
            if (distFromCenter > segmentWidth/2 - 2 && distFromCenter < segmentWidth/2) {
                y -= 1.5;
            }
        } else {
            // Outer areas - mountainous
            y = noise.noise(x * 0.1, z * 0.1) * 5 * difficulty;
            y -= (distFromCenter - segmentWidth/2 - 5) * 0.5; // Slopes down as you go further out
        }
        
        terrainGeometry.attributes.position.setY(i, y);
        
        // Store for physics
        terrainHeightMap.push(y);
    }
    
    terrainGeometry.computeVertexNormals();
    terrainGeometry.attributes.position.needsUpdate = true;
    
    // Rotate to make it align with the z-axis
    terrainGeometry.rotateX(-Math.PI / 2);
    
    // Create materials for the terrain
    const terrainMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4b7022,
        roughness: 0.8,
        metalness: 0.1,
        flatShading: false,
        vertexColors: true
    });
    
    // Add vertex colors based on height
    const colors = [];
    for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
        const y = terrainHeightMap[i];
        
        // Color based on height and distance from center
        const x = terrainGeometry.attributes.position.getX(i);
        const distFromCenter = Math.abs(x);
        
        if (distFromCenter < segmentWidth/2 - 2) {
            // Main track area - asphalt color
            colors.push(0.3, 0.3, 0.3);
        } else if (distFromCenter < segmentWidth/2 + 1) {
            // Track edges - warning stripes
            if (Math.floor((terrainGeometry.attributes.position.getZ(i) + startZ) / 5) % 2 === 0) {
                colors.push(0.9, 0.9, 0.2); // Yellow
            } else {
                colors.push(0.2, 0.2, 0.2); // Black
            }
        } else if (y < -0.5) {
            // Ditches and low areas - darker soil or mud
            colors.push(0.35, 0.2, 0.1);
        } else if (y < 1) {
            // Medium heights - grass
            colors.push(0.3, 0.5, 0.2);
        } else {
            // Higher areas - lighter grass or rocky
            colors.push(0.6, 0.6, 0.5);
        }
    }
    
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.position.set(0, -1, (startZ + endZ) / 2);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    trackGroup.add(terrainMesh);
    
    // Add side barriers
    const barrierHeight = 2;
    const barrierGeometry = new THREE.BoxGeometry(1, barrierHeight, segmentLength);
    const barrierMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
    
    const leftBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    leftBarrier.position.set(-segmentWidth/2 - 0.5, barrierHeight/2, (startZ + endZ) / 2);
    leftBarrier.receiveShadow = true;
    leftBarrier.castShadow = true;
    trackGroup.add(leftBarrier);
    
    const rightBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    rightBarrier.position.set(segmentWidth/2 + 0.5, barrierHeight/2, (startZ + endZ) / 2);
    rightBarrier.receiveShadow = true;
    rightBarrier.castShadow = true;
    trackGroup.add(rightBarrier);
    
    // Add obstacles based on difficulty
    const numObstacles = Math.floor(2 + difficulty * 3);
    const obstacleTypes = [
        { geometry: new THREE.BoxGeometry(2, 2, 2), color: 0xff0000, mass: 10 },
        { geometry: new THREE.SphereGeometry(1.5, 16, 16), color: 0xff6600, mass: 8 },
        { geometry: new THREE.ConeGeometry(1.5, 3, 8), color: 0xff9900, mass: 5 }
    ];
    
    const obstacles = [];
    
    for (let i = 0; i < numObstacles; i++) {
        const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
        const type = obstacleTypes[typeIndex];
        
        const obstacle = new THREE.Mesh(
            type.geometry,
            new THREE.MeshPhongMaterial({ color: type.color })
        );
        
        // Random position within the track segment
        const posX = (Math.random() - 0.5) * (segmentWidth - 4);
        const posZ = startZ - Math.random() * segmentLength;
        
        obstacle.position.set(posX, 1, posZ);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        trackGroup.add(obstacle);
        
        // Add obstacle physics
        let obstacleShape;
        if (typeIndex === 0) { // Box
            obstacleShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
        } else if (typeIndex === 1) { // Sphere
            obstacleShape = new CANNON.Sphere(1.5);
        } else { // Cone approximated with cylinder
            obstacleShape = new CANNON.Cylinder(1.5, 0.1, 3, 8);
        }
        
        const obstacleBody = new CANNON.Body({
            mass: type.mass,
            shape: obstacleShape,
            position: new CANNON.Vec3(posX, 1, posZ),
            material: new CANNON.Material({
                friction: 0.3,
                restitution: 0.4
            })
        });
        
        obstacles.push({ mesh: obstacle, body: obstacleBody });
    }
    
    // Add decorative elements (trees, rocks)
    const numDecor = Math.floor(10 + difficulty * 5);
    const decorTypes = [
        { type: 'tree', color: 0x228B22, scale: 1 }, // Tree
        { type: 'rock', geometry: new THREE.SphereGeometry(1, 6, 4), color: 0x888888, scale: 0.8 }, // Rock
    ];
    
    for (let i = 0; i < numDecor; i++) {
        const typeIndex = Math.floor(Math.random() * decorTypes.length);
        const type = decorTypes[typeIndex];
        
        let decor;
        
        if (type.type === 'tree') {
            // Use the tree group directly
            decor = createTreeGeometry();
            decor.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } else {
            // Create mesh for other decor types
            decor = new THREE.Mesh(
                type.geometry,
                new THREE.MeshPhongMaterial({ color: type.color })
            );
            decor.castShadow = true;
            decor.receiveShadow = true;
        }
        
        // Position outside the main track
        const side = Math.random() > 0.5 ? 1 : -1;
        const posX = side * (segmentWidth/2 + 2 + Math.random() * 8);
        const posZ = startZ - Math.random() * segmentLength;
        
        decor.position.set(posX, 0, posZ);
        decor.scale.set(type.scale, type.scale, type.scale);
        trackGroup.add(decor);
    }
    
    // Create heightfield physics for the terrain
    const heightfieldSize = {
        width: terrainWidthPoints - 1,
        length: terrainLengthPoints - 1
    };
    
    const heightfieldShape = new CANNON.Heightfield(
        reshapeArray(terrainHeightMap, terrainWidthPoints),
        {
            elementSize: segmentWidth / heightfieldSize.width
        }
    );
    
    const groundBody = new CANNON.Body({
        mass: 0,
        material: new CANNON.Material({
            friction: 0.3,
            restitution: 0.3
        })
    });
    
    groundBody.addShape(heightfieldShape, 
        new CANNON.Vec3(-segmentWidth/2, -1, startZ),
        new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2)
    );
    
    // Add side barriers to physics
    const barrierShape = new CANNON.Box(new CANNON.Vec3(0.5, barrierHeight/2, segmentLength/2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(-segmentWidth/2 - 0.5, barrierHeight/2, (startZ + endZ) / 2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(segmentWidth/2 + 0.5, barrierHeight/2, (startZ + endZ) / 2));
    
    // Add slope to make it go downhill
    const slopeAngle = -Math.PI * 0.05;
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), slopeAngle);
    trackGroup.rotation.x = slopeAngle;
    
    return {
        visual: trackGroup,
        body: groundBody,
        obstacles: obstacles,
        startZ: startZ,
        endZ: endZ
    };
}

// Helper function to reshape a flat array into a 2D array for heightfield
function reshapeArray(array, width) {
    const result = [];
    for (let i = 0; i < array.length; i += width) {
        result.push(array.slice(i, i + width));
    }
    return result;
}

// Create a simple tree geometry
function createTreeGeometry() {
    const treeGroup = new THREE.Group();
    
    // Tree trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.4, 2, 8);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1;
    treeGroup.add(trunk);
    
    // Tree top
    const topGeometry = new THREE.ConeGeometry(1.5, 3, 8);
    const topMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 3.5;
    treeGroup.add(top);
    
    return treeGroup;
}