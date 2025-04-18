import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function generateTrackSegment(startZ, endZ, difficulty) {
    const segmentLength = Math.abs(endZ - startZ);
    const segmentWidth = 20;
    
    // Create track visual
    const trackGroup = new THREE.Group();
    
    // Use heightmap for terrain with higher resolution for better detail
    const resolution = 96;
    const noise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(
        segmentWidth + 30, // Wider terrain for better visuals
        segmentLength, 
        resolution, 
        resolution
    );
    
    // Apply noise to vertices to create terrain bumps
    const terrainHeightMap = [];
    const terrainWidthPoints = resolution + 1;
    const terrainLengthPoints = resolution + 1;
    
    // Generate heightmap with better noise patterns
    for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
        const x = terrainGeometry.attributes.position.getX(i);
        const z = terrainGeometry.attributes.position.getZ(i);
        
        // Keep track path fairly flat but bumpy at higher difficulties
        let y = 0;
        
        // More intense bumps off to the sides
        const distFromCenter = Math.abs(x);
        
        if (distFromCenter < segmentWidth/2 - 3) {
            // Main track area - very slightly bumpy at higher difficulties
            // Use multiple noise frequencies for more natural terrain
            y = noise.noise(x * 0.05, z * 0.05) * 0.3 * difficulty +
                noise.noise(x * 0.2, z * 0.1) * 0.1 * difficulty;
                
            // Add some subtle road ripples
            y += Math.sin(z * 0.5) * 0.05 * difficulty;
        } else if (distFromCenter < segmentWidth/2 + 6) {
            // Side areas - more bumpy
            y = noise.noise(x * 0.1, z * 0.08) * 2 * difficulty +
                noise.noise(x * 0.3, z * 0.2) * 1 * difficulty;
            
            // Create a ditch/shoulder at the edge of the main track
            if (distFromCenter > segmentWidth/2 - 3 && distFromCenter < segmentWidth/2) {
                y -= 1.2 + noise.noise(x * 0.5, z * 0.5) * 0.3;
            }
        } else {
            // Outer areas - mountainous
            // Use multiple noise frequencies for more natural hills
            y = noise.noise(x * 0.05, z * 0.05) * 6 * difficulty +
                noise.noise(x * 0.2, z * 0.2) * 3 * difficulty;
            
            // Make mountains higher further from the track
            y += (distFromCenter - segmentWidth/2 - 5) * 0.7;
            
            // Add occasional plateaus and cliffs
            const cliffNoise = noise.noise(x * 0.3, z * 0.1);
            if (cliffNoise > 0.6) {
                y += 5 * (cliffNoise - 0.6);
            }
        }
        
        terrainGeometry.attributes.position.setY(i, y);
        
        // Store for physics
        terrainHeightMap.push(y);
    }
    
    terrainGeometry.computeVertexNormals();
    terrainGeometry.attributes.position.needsUpdate = true;
    
    // Rotate to make it align with the z-axis
    terrainGeometry.rotateX(-Math.PI / 2);
    
    // Create materials for the terrain with improved texturing
    const terrainMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x4b7022,
        roughness: 0.85,
        metalness: 0.1,
        flatShading: false,
        vertexColors: true
    });
    
    // Add vertex colors based on height and more natural terrain features
    const colors = [];
    for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
        const y = terrainHeightMap[i];
        
        // Color based on height and distance from center
        const x = terrainGeometry.attributes.position.getX(i);
        const z = terrainGeometry.attributes.position.getZ(i);
        const distFromCenter = Math.abs(x);
        
        if (distFromCenter < segmentWidth/2 - 3) {
            // Main track area - asphalt color with wear patterns
            const wearEffect = noise.noise(x * 0.5, z * 0.2) * 0.1;
            const trackColor = 0.25 + wearEffect;
            colors.push(trackColor, trackColor, trackColor + 0.02);
            
            // Add subtle lane markers
            if (Math.abs(x) < 1 && Math.floor(z / 5) % 6 === 0) {
                colors[colors.length - 3] = 0.8; // R
                colors[colors.length - 2] = 0.8; // G
                colors[colors.length - 1] = 0.7; // B
            }
        } else if (distFromCenter < segmentWidth/2 && distFromCenter > segmentWidth/2 - 1) {
            // Track edges - warning stripes
            if (Math.floor((z + startZ) / 3) % 2 === 0) {
                colors.push(0.9, 0.9, 0.2); // Yellow
            } else {
                colors.push(0.2, 0.2, 0.2); // Black
            }
        } else if (distFromCenter < segmentWidth/2 + 1.5) {
            // Track shoulder - gravel
            const gravelVariation = noise.noise(x * 1.0, z * 1.0) * 0.15;
            colors.push(0.5 + gravelVariation, 0.45 + gravelVariation, 0.4 + gravelVariation);
        } else if (y < -0.5) {
            // Ditches and low areas - darker soil or mud
            const mudVariation = noise.noise(x * 0.7, z * 0.7) * 0.1;
            colors.push(0.32 + mudVariation, 0.18 + mudVariation, 0.08 + mudVariation);
        } else if (y < 1.5) {
            // Medium heights - grass with variations
            const grassVariation = noise.noise(x * 2.0, z * 2.0) * 0.15;
            colors.push(
                0.25 + grassVariation, 
                0.45 + grassVariation, 
                0.15 + grassVariation
            );
        } else if (y < 5) {
            // Higher areas - lighter grass or rocky
            const rockMix = noise.noise(x * 0.4, z * 0.4);
            if (rockMix > 0.3) {
                // Rocky outcrops
                const rockColor = 0.6 + noise.noise(x * 3, z * 3) * 0.1;
                colors.push(rockColor, rockColor * 0.95, rockColor * 0.9);
            } else {
                // High grass
                const grassVariation = noise.noise(x * 3.0, z * 3.0) * 0.1;
                colors.push(
                    0.4 + grassVariation, 
                    0.55 + grassVariation, 
                    0.2 + grassVariation
                );
            }
        } else {
            // Mountain tops - snow-capped or rocky peaks
            const snowMix = noise.noise(x * 0.2, z * 0.2);
            if (snowMix > 0.2 || y > 10) {
                // Snow
                const snowVariation = noise.noise(x * 5, z * 5) * 0.05;
                colors.push(
                    0.95 + snowVariation, 
                    0.95 + snowVariation, 
                    0.97 + snowVariation
                );
            } else {
                // Rocky peaks
                const rockVariation = noise.noise(x * 2, z * 2) * 0.1;
                colors.push(
                    0.5 + rockVariation, 
                    0.5 + rockVariation, 
                    0.55 + rockVariation
                );
            }
        }
    }
    
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.position.set(0, -1, (startZ + endZ) / 2);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    trackGroup.add(terrainMesh);
    
    // Add improved side barriers with detail
    const barrierHeight = 2.5;
    const barrierGeometry = new THREE.BoxGeometry(1, barrierHeight, segmentLength);
    
    // Create a more detailed barrier material
    const barrierTexture = new THREE.TextureLoader().load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/brick_bump.jpg', undefined, undefined, (err) => {
        // Fallback if texture fails to load
        console.log("Using fallback texture");
    });
    
    const barrierMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc,
        roughness: 0.7,
        metalness: 0.6,
        map: barrierTexture 
    });
    
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
    
    // Add barrier top details (guardrail)
    const railGeometry = new THREE.BoxGeometry(1.2, 0.2, segmentLength);
    const railMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5, metalness: 0.8 });
    
    const leftRail = new THREE.Mesh(railGeometry, railMaterial);
    leftRail.position.set(-segmentWidth/2 - 0.5, barrierHeight + 0.1, (startZ + endZ) / 2);
    leftRail.castShadow = true;
    trackGroup.add(leftRail);
    
    const rightRail = new THREE.Mesh(railGeometry, railMaterial);
    rightRail.position.set(segmentWidth/2 + 0.5, barrierHeight + 0.1, (startZ + endZ) / 2);
    rightRail.castShadow = true;
    trackGroup.add(rightRail);
    
    // Add obstacles based on difficulty with improved variety
    const numObstacles = Math.floor(2 + difficulty * 3);
    const obstacleTypes = [
        { 
            geometry: new THREE.BoxGeometry(2, 2, 2), 
            color: 0xff0000, 
            mass: 10,
            name: 'cube'
        },
        { 
            geometry: new THREE.SphereGeometry(1.5, 16, 16), 
            color: 0xff6600, 
            mass: 8,
            name: 'sphere'
        },
        { 
            geometry: new THREE.ConeGeometry(1.5, 3, 8), 
            color: 0xff9900, 
            mass: 5,
            name: 'cone'
        },
        { 
            geometry: new THREE.TorusGeometry(1.5, 0.5, 8, 24), 
            color: 0xff3366, 
            mass: 7,
            name: 'torus'
        },
        { 
            geometry: new THREE.CylinderGeometry(1, 1, 3, 8), 
            color: 0xffcc00, 
            mass: 12,
            name: 'cylinder'
        }
    ];
    
    const obstacles = [];
    
    for (let i = 0; i < numObstacles; i++) {
        const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
        const type = obstacleTypes[typeIndex];
        
        // Create detailed obstacle with texture/pattern
        const obstacleMaterial = new THREE.MeshStandardMaterial({
            color: type.color,
            roughness: 0.7,
            metalness: 0.3
        });
        
        if (type.name === 'cube') {
            // Add edge highlighting to cube
            const edgeGeometry = new THREE.EdgesGeometry(type.geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            
            const obstacle = new THREE.Mesh(type.geometry, obstacleMaterial);
            obstacle.add(edges);
            
            // Random position within the track segment
            const posX = (Math.random() - 0.5) * (segmentWidth - 4);
            const posZ = startZ - Math.random() * segmentLength;
            
            // Find height at this position for better placement
            const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth, segmentLength);
            
            obstacle.position.set(posX, terrainY + 1, posZ);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            trackGroup.add(obstacle);
            
            // Add obstacle physics
            const obstacleShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
            const obstacleBody = new CANNON.Body({
                mass: type.mass,
                shape: obstacleShape,
                position: new CANNON.Vec3(posX, terrainY + 1, posZ),
                material: new CANNON.Material({
                    friction: 0.3,
                    restitution: 0.4
                })
            });
            
            obstacles.push({ mesh: obstacle, body: obstacleBody });
        } else {
            const obstacle = new THREE.Mesh(type.geometry, obstacleMaterial);
            
            // Random position within the track segment
            const posX = (Math.random() - 0.5) * (segmentWidth - 4);
            const posZ = startZ - Math.random() * segmentLength;
            
            // Find height at this position for better placement
            const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth, segmentLength);
            
            obstacle.position.set(posX, terrainY + 1, posZ);
            obstacle.castShadow = true;
            obstacle.receiveShadow = true;
            trackGroup.add(obstacle);
            
            // Add obstacle physics
            let obstacleShape;
            if (type.name === 'sphere') {
                obstacleShape = new CANNON.Sphere(1.5);
            } else if (type.name === 'cone') {
                obstacleShape = new CANNON.Cylinder(1.5, 0.1, 3, 8);
            } else if (type.name === 'cylinder') {
                obstacleShape = new CANNON.Cylinder(1, 1, 3, 8);
            } else {
                // Fallback for torus or other shapes
                obstacleShape = new CANNON.Sphere(1.5);
            }
            
            const obstacleBody = new CANNON.Body({
                mass: type.mass,
                shape: obstacleShape,
                position: new CANNON.Vec3(posX, terrainY + 1, posZ),
                material: new CANNON.Material({
                    friction: 0.3,
                    restitution: 0.4
                })
            });
            
            obstacles.push({ mesh: obstacle, body: obstacleBody });
        }
    }
    
    // Add decorative elements (trees, rocks) with better placement
    const numDecor = Math.floor(15 + difficulty * 8);
    const decorTypes = [
        { type: 'tree', color: 0x228B22, scale: 1 },
        { type: 'smalltree', color: 0x3CA832, scale: 0.6 },
        { type: 'rock', geometry: new THREE.SphereGeometry(1, 6, 4), color: 0x888888, scale: 0.8 },
        { type: 'bigrock', geometry: new THREE.SphereGeometry(2, 6, 4), color: 0x777777, scale: 1.2 },
    ];
    
    for (let i = 0; i < numDecor; i++) {
        const typeIndex = Math.floor(Math.random() * decorTypes.length);
        const type = decorTypes[typeIndex];
        
        let decor;
        
        if (type.type === 'tree' || type.type === 'smalltree') {
            decor = createTreeGeometry(type.type === 'smalltree');
            decor.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
        } else {
            // Create mesh for rock types
            const rockMaterial = new THREE.MeshStandardMaterial({ 
                color: type.color,
                roughness: 0.9,
                metalness: 0.1,
                flatShading: true
            });
            
            decor = new THREE.Mesh(type.geometry, rockMaterial);
            
            // Apply random rotation for more natural look
            decor.rotation.x = Math.random() * Math.PI;
            decor.rotation.y = Math.random() * Math.PI;
            decor.rotation.z = Math.random() * Math.PI;
            
            decor.castShadow = true;
            decor.receiveShadow = true;
        }
        
        // Position outside the main track with some clustering
        const side = Math.random() > 0.5 ? 1 : -1;
        const posX = side * (segmentWidth/2 + 2 + Math.random() * 12);
        const posZ = startZ - Math.random() * segmentLength;
        
        // Find height at this position for better placement
        const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth + 30, segmentLength);
        
        decor.position.set(posX, terrainY, posZ);
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
            elementSize: (segmentWidth + 30) / heightfieldSize.width
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
        new CANNON.Vec3(-(segmentWidth + 30)/2, -1, startZ),
        new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2)
    );
    
    // Add side barriers to physics
    const barrierShape = new CANNON.Box(new CANNON.Vec3(0.5, barrierHeight/2, segmentLength/2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(-segmentWidth/2 - 0.5, barrierHeight/2, (startZ + endZ) / 2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(segmentWidth/2 + 0.5, barrierHeight/2, (startZ + endZ) / 2));
    
    // Add more pronounced slope to make it go downhill
    const slopeAngle = -Math.PI * 0.07; // Steeper slope
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
        if (i + width <= array.length) {
            result.push(array.slice(i, i + width));
        }
    }
    return result;
}

// Helper function to find the height of terrain at a specific point
function getTerrainHeightAt(x, z, startZ, heightMap, widthPoints, lengthPoints, width, length) {
    // Convert world coords to heightmap indices
    const halfWidth = width / 2;
    const normalizedX = (x + halfWidth) / width;
    const normalizedZ = (z - startZ) / length;
    
    // Clamp to valid range
    const clampedX = Math.max(0, Math.min(0.999, normalizedX));
    const clampedZ = Math.max(0, Math.min(0.999, normalizedZ));
    
    // Find the heightmap indices
    const xIndex = Math.floor(clampedX * (widthPoints - 1));
    const zIndex = Math.floor(clampedZ * (lengthPoints - 1));
    
    // Get height from heightmap
    return heightMap[zIndex * widthPoints + xIndex] || 0;
}

// Create a more detailed tree geometry
function createTreeGeometry(isSmall = false) {
    const treeGroup = new THREE.Group();
    
    // More natural trunk with thicker base
    const trunkHeight = isSmall ? 1.2 : 2;
    const trunkGeometry = new THREE.CylinderGeometry(
        isSmall ? 0.1 : 0.2,  // top radius
        isSmall ? 0.2 : 0.4,  // bottom radius
        trunkHeight, 
        8
    );
    
    // Create trunk material with wood-like coloring
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513,
        roughness: 0.9,
        metalness: 0.1,
        flatShading: true
    });
    
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    treeGroup.add(trunk);
    
    // Multiple levels of foliage for more realism
    const foliageLevels = isSmall ? 1 : 2;
    const baseSize = isSmall ? 1.2 : 1.5;
    
    for (let i = 0; i < foliageLevels; i++) {
        const y = trunkHeight + (i * 1.2);
        const size = baseSize - (i * 0.3);
        
        // Cone for coniferous trees with slight color variation
        const foliageGeometry = new THREE.ConeGeometry(size, size * 2, 8);
        const greenHue = isSmall ? 0.33 + Math.random() * 0.05 : 0.28 + Math.random() * 0.05;
        
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(greenHue, 0.8, 0.35),
            roughness: 0.8,
            metalness: 0.1
        });
        
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = y + size;
        foliage.castShadow = true;
        treeGroup.add(foliage);
    }
    
    return treeGroup;
}