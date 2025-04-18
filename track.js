import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function generateTrackSegment(startZ, endZ, difficulty, isStartingSegment = false) {
    const segmentLength = Math.abs(endZ - startZ);
    const segmentWidth = 20;
    
    // Create track visual
    const trackGroup = new THREE.Group();
    
    // Higher resolution for better terrain detail
    const resolution = isStartingSegment ? 64 : 128;
    const noise = new SimplexNoise();
    const terrainGeometry = new THREE.PlaneGeometry(
        segmentWidth + 60, 
        segmentLength, 
        resolution, 
        resolution
    );
    
    // Apply noise to vertices to create terrain bumps
    const terrainHeightMap = [];
    const terrainWidthPoints = resolution + 1;
    const terrainLengthPoints = resolution + 1;
    
    // Generate heightmap with improved noise patterns
    for (let i = 0; i < terrainGeometry.attributes.position.count; i++) {
        const x = terrainGeometry.attributes.position.getX(i);
        const z = terrainGeometry.attributes.position.getZ(i);
        
        // Calculate distance from center track
        const distFromCenter = Math.abs(x);
        
        // Initialize height
        let y = 0;
        
        // Base noise at different scales for more natural terrain
        const baseNoise1 = noise.noise(x * 0.02, z * 0.02) * 15;
        const baseNoise2 = noise.noise(x * 0.05, z * 0.05) * 7;
        const baseNoise3 = noise.noise(x * 0.1, z * 0.1) * 3;
        const detailNoise = noise.noise(x * 0.3, z * 0.3) * 1.5;
        
        // Special handling for starting segment - make it flatter and more gentle
        if (isStartingSegment) {
            // Calculate how far we are in the starting segment (0 = start, 1 = end)
            const progressInSegment = (z - startZ) / segmentLength;
            const startFlatness = Math.max(0, 1 - progressInSegment * 3); // More flat at the beginning
            
            if (distFromCenter < segmentWidth/2 - 3) {
                // Very flat starting area that gradually introduces bumps
                y = startFlatness * 0 + (1-startFlatness) * (
                    noise.noise(x * 0.1, z * 0.05) * 0.3 * difficulty +
                    noise.noise(x * 0.3, z * 0.2) * 0.15 * difficulty
                );
                
                // Add subtle starting ramp
                if (progressInSegment < 0.3) {
                    y += progressInSegment * 0.5; // Slight upward ramp at very start
                }
            } else if (distFromCenter < segmentWidth/2) {
                // Track edge with more prominent visual cues
                const edgeFactor = (distFromCenter - (segmentWidth/2 - 3)) / 3;
                y = noise.noise(x * 0.1, z * 0.05) * 0.3 * difficulty * (1-startFlatness);
                
                // Higher edge banking at start for better visual cues
                y += edgeFactor * 1.2;
            } else {
                // Outside terrain transitions from flat to normal
                y = (1-startFlatness) * (
                    baseNoise1 + baseNoise2 * 0.5 + baseNoise3 * 0.3 + detailNoise
                );
                
                // Add visual wall at edges of starting area
                if (progressInSegment < 0.2 && distFromCenter < segmentWidth/2 + 5) {
                    y += (1 - progressInSegment * 5) * 3;
                }
            }
        } else {
            // Normal terrain generation for non-starting segments
            if (distFromCenter < segmentWidth/2 - 4) {
                // Main track area - slightly bumpy with ruts and grooves
                y = noise.noise(x * 0.1, z * 0.05) * 0.6 * difficulty +
                    noise.noise(x * 0.3, z * 0.2) * 0.3 * difficulty;
                    
                // Add some track features - racing grooves and center ridge
                y += Math.sin(x * 3) * 0.1;
                
                // Add some subtle downhill ripples
                y += Math.sin(z * 0.8) * 0.15 * difficulty;
                
                // Add occasional potholes
                if (noise.noise(x * 0.5, z * 0.3) > 0.7) {
                    y -= 0.3 * difficulty;
                }
            } else if (distFromCenter < segmentWidth/2) {
                // Track edge - create a slight banking effect
                const edgeFactor = (distFromCenter - (segmentWidth/2 - 4)) / 4;
                y = noise.noise(x * 0.1, z * 0.05) * 0.6 * difficulty +
                    noise.noise(x * 0.3, z * 0.2) * 0.3 * difficulty;
                
                // Bank the edges slightly upward
                y += edgeFactor * 0.8;
                
                // Add edge texture variations
                y += noise.noise(x * 1.0, z * 0.5) * 0.4 * difficulty;
            } else if (distFromCenter < segmentWidth/2 + 8) {
                // Shoulder area - more varied with ditches and mounds
                const shoulderDist = distFromCenter - segmentWidth/2;
                
                // Create a ditch near the track edge
                if (shoulderDist < 2) {
                    y = -1.5 + noise.noise(x * 0.5, z * 0.3) * 0.8 * difficulty;
                } else {
                    // Transition to surrounding terrain
                    const mix = (shoulderDist - 2) / 6;
                    
                    // Mix between shoulder terrain and outer terrain
                    y = (1-mix) * (
                        -0.5 + noise.noise(x * 0.2, z * 0.1) * 2 * difficulty +
                        noise.noise(x * 0.4, z * 0.3) * 1 * difficulty
                    ) + mix * (
                        baseNoise1 + baseNoise2 * 0.5 + baseNoise3 * 0.3 + detailNoise
                    );
                    
                    // Add occasional debris mounds
                    if (noise.noise(x * 0.6, z * 0.4) > 0.7) {
                        y += 1.5 * difficulty;
                    }
                }
            } else {
                // Outer mountain areas - dramatic and varied
                
                // Base height influenced by distance from track
                const mountainBaseFactor = Math.min(1, (distFromCenter - segmentWidth/2 - 8) / 30);
                const mountainHeight = 20 + 30 * mountainBaseFactor;
                
                // Combine multiple noise frequencies for natural mountains
                y = baseNoise1 * mountainBaseFactor * 1.5 + 
                    baseNoise2 * mountainBaseFactor + 
                    baseNoise3 * 0.7 + 
                    detailNoise * 0.5;
                
                // Scale height based on distance
                y *= (0.5 + mountainBaseFactor);
                
                // Add dramatic cliff features
                const cliffNoise = noise.noise(x * 0.15, z * 0.15);
                if (cliffNoise > 0.6) {
                    y += (cliffNoise - 0.6) * 20 * mountainBaseFactor;
                }
                
                // Add plateau features
                const plateauNoise = noise.noise(x * 0.08, z * 0.08);
                if (plateauNoise > 0.7 && plateauNoise < 0.8) {
                    y = Math.floor(y / 5) * 5 + 
                        noise.noise(x * 0.6, z * 0.6) * 1.5;
                }
                
                // Add canyon features
                const canyonNoise = noise.noise(x * 0.04, z * 0.04);
                if (canyonNoise < -0.6) {
                    y -= Math.abs(canyonNoise + 0.6) * 15 * mountainBaseFactor;
                }
                
                // Add ridges perpendicular to track
                y += Math.abs(Math.sin(x * 0.05)) * 5 * mountainBaseFactor;
            }
        }
        
        terrainGeometry.attributes.position.setY(i, y);
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
        
        // Local variations for natural appearance
        const localNoise = noise.noise(x * 0.5, z * 0.5) * 0.1;
        const microNoise = noise.noise(x * 3.0, z * 3.0) * 0.05;
        
        if (isStartingSegment) {
            // Special coloring for starting segment
            const progressInSegment = (z - startZ) / segmentLength;
            
            if (distFromCenter < segmentWidth/2 - 3) {
                // Starting track - more distinct pattern
                if (progressInSegment < 0.1) {
                    // Starting line pattern
                    if (Math.floor((z + startZ) / 1) % 2 === 0) {
                        colors.push(0.9, 0.9, 0.9); // White
                    } else {
                        colors.push(0.1, 0.1, 0.1); // Black
                    }
                } else {
                    // Main track with arrow patterns pointing downhill
                    const trackColor = 0.3 + noise.noise(x * 0.8, z * 0.3) * 0.1;
                    
                    // Add arrow patterns pointing down the track
                    if (Math.abs(x) < 4 && Math.floor(((z + startZ) / 5) + 10) % 20 < 3) {
                        const arrowPosition = ((z + startZ) % 5) / 5;
                        if (arrowPosition > 0.3 && arrowPosition < 0.7) {
                            colors.push(0.95, 0.95, 0.2); // Yellow arrow
                        } else {
                            colors.push(trackColor, trackColor, trackColor);
                        }
                    } else {
                        colors.push(trackColor, trackColor, trackColor);
                    }
                }
            } else if (distFromCenter < segmentWidth/2) {
                // Track edges - more visible stripes
                if (Math.floor((z + startZ) / 1.5) % 2 === 0) {
                    colors.push(0.95, 0.95, 0.2); // Bright yellow
                } else {
                    colors.push(0.1, 0.1, 0.1); // Black
                }
            } else {
                // Outside terrain - grass colors
                const grassVariation = noise.noise(x * 0.7, z * 0.7) * 0.2;
                colors.push(
                    0.2 + grassVariation * 0.5, 
                    0.5 + grassVariation, 
                    0.1 + grassVariation * 0.5
                );
            }
        } else {
            // Regular segment coloring
            if (distFromCenter < segmentWidth/2 - 4) {
                // Main track area - asphalt with more detailed wear patterns
                const wearEffect = noise.noise(x * 0.8, z * 0.3) * 0.15;
                const trackColor = 0.25 + wearEffect;
                
                // Add tire marks and road wear
                const laneWear = Math.abs(x) < 2 ? 0.1 : 0;
                const ageColor = noise.noise(x * 0.3, z * 0.8) * 0.08;
                
                colors.push(trackColor + laneWear, trackColor - ageColor, trackColor - 0.05);
                
                // Add lane markers
                if (Math.abs(x) < 0.8 && Math.floor(z / 5) % 6 === 0) {
                    colors[colors.length - 3] = 0.9; 
                    colors[colors.length - 2] = 0.9; 
                    colors[colors.length - 1] = 0.8; 
                }
            } else if (distFromCenter < segmentWidth/2) {
                // Track edges - more prominent warning stripes
                if (Math.floor((z + startZ) / 2.5) % 2 === 0) {
                    colors.push(0.95, 0.95, 0.2); 
                } else {
                    colors.push(0.15, 0.15, 0.15); 
                }
            } else if (distFromCenter < segmentWidth/2 + 2) {
                // Track shoulder - gravel and dirt with more variation
                const gravelVariation = noise.noise(x * 2.0, z * 1.5) * 0.2;
                const stoneChance = noise.noise(x * 5.0, z * 5.0);
                
                if (stoneChance > 0.7) {
                    // Occasional stones
                    colors.push(0.7 + microNoise, 0.7 + microNoise, 0.65 + microNoise);
                } else {
                    // Regular gravel
                    colors.push(0.55 + gravelVariation, 0.46 + gravelVariation, 0.35 + gravelVariation);
                }
            } else if (distFromCenter < segmentWidth/2 + 8) {
                // Transition area - varies based on distance
                const shoulderDist = distFromCenter - segmentWidth/2;
                
                if (shoulderDist < 2) {
                    // Ditch area - darker, wetter soil
                    const mudVariation = noise.noise(x * 1.0, z * 1.0) * 0.15;
                    colors.push(0.25 + mudVariation, 0.15 + mudVariation, 0.05 + mudVariation);
                } else if (y < 0) {
                    // Low spots - mud and water
                    const waterChance = noise.noise(x * 0.5, z * 0.5);
                    if (waterChance > 0.7 && y < -1) {
                        // Small water puddles
                        colors.push(0.1, 0.2 + microNoise, 0.35 + microNoise);
                    } else {
                        // Mud
                        colors.push(0.3 + microNoise, 0.2 + microNoise, 0.1 + microNoise);
                    }
                } else {
                    // Regular soil transitioning to vegetation
                    const vegetation = Math.min(1, (shoulderDist - 2) / 4);
                    
                    colors.push(
                        0.3 + localNoise - vegetation * 0.1,
                        0.25 + localNoise + vegetation * 0.25,
                        0.2 + localNoise
                    );
                }
            } else {
                // Outer terrain - varied based on height and features
                if (y < 0) {
                    // Depressions and valleys - darker soils
                    const valleyColor = noise.noise(x * 0.3, z * 0.3);
                    colors.push(
                        0.25 + valleyColor * 0.1, 
                        0.2 + valleyColor * 0.05, 
                        0.15 + valleyColor * 0.05
                    );
                } else if (y < 5) {
                    // Low areas - grass and vegetation
                    const grassVariation = noise.noise(x * 0.7, z * 0.7) * 0.2;
                    colors.push(
                        0.2 + grassVariation * 0.5, 
                        0.4 + grassVariation, 
                        0.1 + grassVariation * 0.5
                    );
                    
                    // Add flowers and ground cover
                    if (noise.noise(x * 3, z * 3) > 0.8) {
                        colors[colors.length - 3] += 0.3; 
                        colors[colors.length - 2] += 0.1;
                    }
                } else if (y < 15) {
                    // Mid-elevation - mixed vegetation
                    const mixFactor = (y - 5) / 10;
                    const rockNoise = noise.noise(x * 0.5, z * 0.5);
                    
                    if (rockNoise > 0.6) {
                        // Rocky outcroppings
                        const rockColor = 0.6 + noise.noise(x * 2, z * 2) * 0.15;
                        colors.push(rockColor, rockColor * 0.95, rockColor * 0.9);
                    } else {
                        // Mixed vegetation
                        colors.push(
                            0.3 - mixFactor * 0.1 + localNoise, 
                            0.5 - mixFactor * 0.1 + localNoise, 
                            0.2 - mixFactor * 0.05 + localNoise
                        );
                    }
                } else if (y < 25) {
                    // Higher elevation - rocky terrain
                    const rockVariation = noise.noise(x * 1.5, z * 1.5) * 0.15;
                    colors.push(
                        0.5 + rockVariation, 
                        0.45 + rockVariation, 
                        0.4 + rockVariation
                    );
                    
                    // Add moss patches
                    if (noise.noise(x * 4, z * 4) > 0.7) {
                        colors[colors.length - 2] += 0.15; 
                    }
                } else {
                    // Mountain tops - snow with rock showing through
                    const elevation = Math.min(1, (y - 25) / 20);
                    const snowNoise = noise.noise(x * 0.8, z * 0.8);
                    const snowAmount = elevation + snowNoise * 0.3;
                    
                    if (snowAmount > 0.5) {
                        // Snow covered
                        const snowVariation = noise.noise(x * 3, z * 3) * 0.06;
                        colors.push(
                            0.95 + snowVariation, 
                            0.95 + snowVariation, 
                            0.97 + snowVariation
                        );
                        
                        // Blue tint in shadow areas
                        if (noise.noise(x * 5, z * 5) > 0.7) {
                            colors[colors.length - 1] += 0.03;
                            colors[colors.length - 3] -= 0.03;
                        }
                    } else {
                        // Rocky peaks
                        const rockVariation = noise.noise(x * 2, z * 2) * 0.15;
                        colors.push(
                            0.45 + rockVariation, 
                            0.4 + rockVariation, 
                            0.35 + rockVariation
                        );
                    }
                }
            }
        }
    }
    
    terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrainMesh.position.set(0, -1, (startZ + endZ) / 2);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    trackGroup.add(terrainMesh);
    
    // Enhanced barrier styles for better visibility
    const barrierHeight = 3.5; // Taller barriers
    const barrierGeometry = new THREE.BoxGeometry(1.2, barrierHeight, segmentLength);
    
    // Create barrier material with stripes
    const barrierMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xdd2222, 
        roughness: 0.6,
        metalness: 0.5,
        emissive: 0x330000,
        emissiveIntensity: 0.2 // Add subtle glow
    });
    
    // Add barriers with improved visibility
    const leftBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    leftBarrier.position.set(-segmentWidth/2 - 0.6, barrierHeight/2, (startZ + endZ) / 2);
    leftBarrier.receiveShadow = true;
    leftBarrier.castShadow = true;
    trackGroup.add(leftBarrier);
    
    const rightBarrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    rightBarrier.position.set(segmentWidth/2 + 0.6, barrierHeight/2, (startZ + endZ) / 2);
    rightBarrier.receiveShadow = true;
    rightBarrier.castShadow = true;
    trackGroup.add(rightBarrier);
    
    // Add reflectors on barriers for better visibility
    const reflectorGeometry = new THREE.BoxGeometry(0.2, 0.5, 1);
    const reflectorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        emissive: 0xffff00,
        emissiveIntensity: 0.8, // Brighter reflectors
        roughness: 0.3, 
        metalness: 0.8 
    });
    
    // Add reflectors along the barriers
    for (let z = 0; z < segmentLength; z += 10) {
        const leftReflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
        leftReflector.position.set(-segmentWidth/2 - 0.6, barrierHeight - 0.5, (startZ + endZ) / 2 - z);
        trackGroup.add(leftReflector);
        
        const rightReflector = new THREE.Mesh(reflectorGeometry, reflectorMaterial);
        rightReflector.position.set(segmentWidth/2 + 0.6, barrierHeight - 0.5, (startZ + endZ) / 2 - z);
        trackGroup.add(rightReflector);
    }
    
    // Special starting area decoration
    if (isStartingSegment) {
        // Starting line markers
        const startLineWidth = segmentWidth - 4;
        const startLineGeometry = new THREE.BoxGeometry(startLineWidth, 0.1, 3);
        const startLineMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            emissive: 0xffffff,
            emissiveIntensity: 0.3
        });
        
        const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
        startLine.position.set(0, 0.05, startZ + 10); // 10 units from the start
        trackGroup.add(startLine);
        
        // Starting pylons/markers
        for (let x = -startLineWidth/2; x <= startLineWidth/2; x += 4) {
            const pylonGeometry = new THREE.CylinderGeometry(0.4, 0.6, 5, 8);
            const pylonMaterial = new THREE.MeshStandardMaterial({ 
                color: x % 8 === 0 ? 0xff0000 : 0x0066ff,
                emissive: x % 8 === 0 ? 0x660000 : 0x003366,
                emissiveIntensity: 0.3
            });
            
            const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
            pylon.position.set(x, 2.5, startZ + 10);
            trackGroup.add(pylon);
            
            // Add pylon flag
            const flagGeometry = new THREE.BoxGeometry(0.05, 2, 1);
            const flagMaterial = new THREE.MeshStandardMaterial({ 
                color: x % 8 === 0 ? 0xff6600 : 0x00ccff,
                emissive: x % 8 === 0 ? 0x662200 : 0x004455,
                emissiveIntensity: 0.3
            });
            
            const flag = new THREE.Mesh(flagGeometry, flagMaterial);
            flag.position.set(0, 1.8, 0.4);
            pylon.add(flag);
        }
        
        // Starting area lights - add some dramatic lighting
        for (let x = -startLineWidth/2; x <= startLineWidth/2; x += 10) {
            const spotLight = new THREE.SpotLight(0xffffff, 5);
            spotLight.position.set(x, 10, startZ + 15);
            spotLight.angle = 0.3;
            spotLight.distance = 30;
            spotLight.penumbra = 0.5;
            spotLight.decay = 1.5;
            spotLight.castShadow = true;
            
            spotLight.target.position.set(x, 0, startZ + 10);
            trackGroup.add(spotLight.target);
            trackGroup.add(spotLight);
        }
        
        // Fewer obstacles in starting area
        const numObstacles = isStartingSegment ? 1 : Math.floor(3 + difficulty * 4);
    } else {
        // Add more dynamic obstacles for non-starting segments
        const numObstacles = Math.floor(3 + difficulty * 4);
        const obstacleTypes = [
            { 
                geometry: new THREE.BoxGeometry(2.5, 2.5, 2.5), 
                color: 0xff0000, 
                mass: 12,
                name: 'cube'
            },
            { 
                geometry: new THREE.SphereGeometry(1.8, 20, 20), 
                color: 0xff6600, 
                mass: 10,
                name: 'sphere'
            },
            { 
                geometry: new THREE.ConeGeometry(1.8, 3.5, 12), 
                color: 0xff9900, 
                mass: 7,
                name: 'cone'
            },
            { 
                geometry: new THREE.TorusGeometry(1.8, 0.7, 12, 24), 
                color: 0xff3366, 
                mass: 9,
                name: 'torus'
            },
            { 
                geometry: new THREE.CylinderGeometry(1.2, 1.2, 3.5, 12), 
                color: 0xffcc00, 
                mass: 15,
                name: 'cylinder'
            },
            {
                geometry: new THREE.TetrahedronGeometry(2),
                color: 0x00ccff,
                mass: 8,
                name: 'tetrahedron'
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
                metalness: 0.3,
                emissive: type.color,
                emissiveIntensity: 0.2 // Add subtle glow for visibility
            });
            
            if (type.name === 'cube') {
                // Add edge highlighting to cube
                const edgeGeometry = new THREE.EdgesGeometry(type.geometry);
                const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
                const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
                
                const obstacle = new THREE.Mesh(type.geometry, obstacleMaterial);
                obstacle.add(edges);
                
                // Random position within the track segment
                const posX = (Math.random() - 0.5) * (segmentWidth - 6); // Keep further from edges
                const posZ = startZ - Math.random() * (segmentLength - 10) - 5; // Keep away from segment ends
                
                // Find height at this position for better placement
                const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth, segmentLength);
                
                obstacle.position.set(posX, terrainY + 1.5, posZ); // Lift slightly to prevent initial collision
                obstacle.castShadow = true;
                obstacle.receiveShadow = true;
                trackGroup.add(obstacle);
                
                // Add obstacle physics with improved collision
                const obstacleShape = new CANNON.Box(new CANNON.Vec3(1.25, 1.25, 1.25));
                const obstacleBody = new CANNON.Body({
                    mass: type.mass,
                    shape: obstacleShape,
                    position: new CANNON.Vec3(posX, terrainY + 1.5, posZ),
                    material: new CANNON.Material({
                        friction: 0.3,
                        restitution: 0.4
                    }),
                    sleepSpeedLimit: 1.0 // Allow objects to sleep when nearly static
                });
                
                obstacles.push({ mesh: obstacle, body: obstacleBody });
            } else {
                const obstacle = new THREE.Mesh(type.geometry, obstacleMaterial);
                
                // Random position within the track segment
                const posX = (Math.random() - 0.5) * (segmentWidth - 6);
                const posZ = startZ - Math.random() * (segmentLength - 10) - 5;
                
                // Find height at this position for better placement
                const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth, segmentLength);
                
                obstacle.position.set(posX, terrainY + 1.5, posZ);
                obstacle.castShadow = true;
                obstacle.receiveShadow = true;
                trackGroup.add(obstacle);
                
                // Add obstacle physics with better shape matching
                let obstacleShape;
                if (type.name === 'sphere') {
                    obstacleShape = new CANNON.Sphere(1.8);
                } else if (type.name === 'cone') {
                    // Better cone approximation
                    obstacleShape = new CANNON.Cylinder(0.2, 1.8, 3.5, 8);
                } else if (type.name === 'cylinder') {
                    obstacleShape = new CANNON.Cylinder(1.2, 1.2, 3.5, 8);
                } else if (type.name === 'tetrahedron') {
                    // Better tetrahedron approximation
                    obstacleShape = new CANNON.ConvexPolyhedron({
                        vertices: [
                            new CANNON.Vec3(0, 2, 0),
                            new CANNON.Vec3(-1.5, -1, -1),
                            new CANNON.Vec3(1.5, -1, -1),
                            new CANNON.Vec3(0, -1, 1.5)
                        ],
                        faces: [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]]
                    });
                } else {
                    // Fallback for torus or other shapes
                    obstacleShape = new CANNON.Sphere(1.5);
                }
                
                const obstacleBody = new CANNON.Body({
                    mass: type.mass,
                    shape: obstacleShape,
                    position: new CANNON.Vec3(posX, terrainY + 1.5, posZ),
                    material: new CANNON.Material({
                        friction: 0.3,
                        restitution: 0.4
                    }),
                    sleepSpeedLimit: 1.0
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
            const terrainY = getTerrainHeightAt(posX, posZ, startZ, terrainHeightMap, terrainWidthPoints, terrainLengthPoints, segmentWidth + 60, segmentLength);
            
            decor.position.set(posX, terrainY, posZ);
            decor.scale.set(type.scale, type.scale, type.scale);
            trackGroup.add(decor);
        }
    }
    
    // Create heightfield physics for the terrain
    const heightfieldSize = {
        width: terrainWidthPoints - 1,
        length: terrainLengthPoints - 1
    };
    
    const heightfieldShape = new CANNON.Heightfield(
        reshapeArray(terrainHeightMap, terrainWidthPoints),
        {
            elementSize: (segmentWidth + 60) / heightfieldSize.width
        }
    );
    
    const groundBody = new CANNON.Body({
        mass: 0,
        material: new CANNON.Material({
            friction: 0.5, // Increased friction for better rolling control
            restitution: 0.3
        })
    });
    
    groundBody.addShape(heightfieldShape, 
        new CANNON.Vec3(-(segmentWidth + 60)/2, -1, startZ),
        new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI/2)
    );
    
    // Add side barriers to physics
    const barrierShape = new CANNON.Box(new CANNON.Vec3(0.6, barrierHeight/2, segmentLength/2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(-segmentWidth/2 - 0.6, barrierHeight/2, (startZ + endZ) / 2));
    groundBody.addShape(barrierShape, new CANNON.Vec3(segmentWidth/2 + 0.6, barrierHeight/2, (startZ + endZ) / 2));
    
    // Adjust slope based on segment type
    const slopeAngle = isStartingSegment ? -Math.PI * 0.05 : -Math.PI * 0.1; // Gentler slope for starting segment
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), slopeAngle);
    trackGroup.rotation.x = slopeAngle;
    
    // Return track data with obstacles if we have them
    const segmentData = {
        visual: trackGroup,
        body: groundBody,
        startZ: startZ,
        endZ: endZ,
        isStartingSegment: isStartingSegment
    };
    
    if (typeof obstacles !== 'undefined' && obstacles.length > 0) {
        segmentData.obstacles = obstacles;
    } else {
        segmentData.obstacles = []; // Always provide an obstacles array even if empty
    }
    
    return segmentData;
}

function reshapeArray(array, width) {
    const result = [];
    for (let i = 0; i < array.length; i += width) {
        if (i + width <= array.length) {
            result.push(array.slice(i, i + width));
        }
    }
    return result;
}

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

function createTreeGeometry(isSmall = false) {
    const treeGroup = new THREE.Group();
    
    // More natural trunk with thicker base
    const trunkHeight = isSmall ? 1.2 : 2;
    const trunkGeometry = new THREE.CylinderGeometry(
        isSmall ? 0.1 : 0.2,  
        isSmall ? 0.2 : 0.4,  
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