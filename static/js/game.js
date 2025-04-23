import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Set black background
        
        // Flight control properties
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.keys = {};
        this.maxSpeed = 1.0;           // Maximum speed
        this.acceleration = 0.02;      // Acceleration rate
        this.deceleration = 0.01;      // Deceleration rate
        this.yawSpeed = 0.02;          // Turning speed
        this.pitchSpeed = 0.03;        // Pitch speed
        this.rollSpeed = 0.04;         // Roll speed
        this.smoothing = 0.15;         // Rotation smoothing
        this.drag = 0.98;              // Velocity drag (less than 1 to slow down)

        // Weapon properties
        this.lasers = [];
        this.laserSpeed = 2;
        this.lastFireTime = 0;
        this.fireRate = 200;           // Milliseconds between shots
        this.maxLasers = 100;         // Maximum number of lasers in the scene
        
        // Use a wider FOV for better visibility
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false, // Disable alpha to prevent transparency
            physicallyCorrectLights: true
        });
        this.renderer.setClearColor(0x000000, 1); // Set clear color to black
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        this.loader = new GLTFLoader();
        this.clock = new THREE.Clock();
        
        this.init();
        this.createScene();
        this.animate();
    }

    calculateResponsiveScale() {
        // Base scale on viewport size
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const smallestDimension = Math.min(viewportWidth, viewportHeight);
        
        // Calculate a scale factor (smaller screens = smaller model)
        // These values can be adjusted based on your needs
        const baseScale = 0.05;
        const scaleFactor = (smallestDimension / 1920) * baseScale;
        
        return Math.max(scaleFactor, 0.02); // Ensure minimum scale
    }

    setupControls() {
        // Add keyboard event listeners
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));

        // Add control instructions
        const instructions = document.createElement('div');
        instructions.style.position = 'absolute';
        instructions.style.bottom = '20px';
        instructions.style.left = '20px';
        instructions.style.color = '#FFE81F';
        instructions.style.fontFamily = 'Arial, sans-serif';
        instructions.style.fontSize = '14px';
        instructions.style.textShadow = '0 0 5px rgba(255, 232, 31, 0.5)';
        instructions.innerHTML = `
            Controls:<br>
            W/S - Pitch up/down<br>
            A/D - Turn left/right<br>
            Z/C - Roll left/right<br>
            Q - Thrust<br>
            E - Brake<br>
            Space - Fire Lasers
        `;
        this.container.appendChild(instructions);
    }

    handleKeyDown(event) {
        this.keys[event.key.toLowerCase()] = true;
    }

    handleKeyUp(event) {
        this.keys[event.key.toLowerCase()] = false;
    }

    createLaser() {
        // Create laser geometry
        const laserGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        laserGeometry.rotateX(Math.PI / 2); // Rotate to point forward

        // Create laser material with glow effect
        const laserMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.8
        });

        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        
        // Add glow effect
        const glowGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
        glowGeometry.rotateX(Math.PI / 2);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        laser.add(glow);

        return laser;
    }

    fireLasers() {
        if (!this.xwing) return;

        const now = Date.now();
        if (now - this.lastFireTime < this.fireRate) return;
        this.lastFireTime = now;

        // Create four lasers (one from each cannon)
        const laserOffsets = [
            new THREE.Vector3(-0.5, 0.2, 0),  // Top left
            new THREE.Vector3(0.5, 0.2, 0),   // Top right
            new THREE.Vector3(-0.5, -0.2, 0), // Bottom left
            new THREE.Vector3(0.5, -0.2, 0)   // Bottom right
        ];

        laserOffsets.forEach(offset => {
            const laser = this.createLaser();
            
            // Position laser at X-Wing's cannon positions
            laser.position.copy(this.xwing.position);
            laser.position.add(offset);
            
            // Apply X-Wing's rotation to laser
            laser.rotation.copy(this.xwing.rotation);
            
            // Store laser velocity based on X-Wing's direction
            laser.userData.velocity = new THREE.Vector3(0, 0, this.laserSpeed);
            laser.userData.velocity.applyQuaternion(this.xwing.quaternion);
            
            this.scene.add(laser);
            this.lasers.push(laser);

            // Remove oldest laser if we exceed the maximum
            if (this.lasers.length > this.maxLasers) {
                const oldLaser = this.lasers.shift();
                this.scene.remove(oldLaser);
            }

            // Add muzzle flash effect
            this.createMuzzleFlash(laser.position);
        });

        // Play laser sound (to be added later)
    }

    createMuzzleFlash(position) {
        const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000,
            transparent: true,
            opacity: 1
        });

        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);

        // Animate and remove the flash
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < 50) {
                flash.material.opacity = 1 - (elapsed / 50);
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(flash);
            }
        };
        animate();
    }

    updateLasers() {
        for (let i = this.lasers.length - 1; i >= 0; i--) {
            const laser = this.lasers[i];
            
            // Move laser
            laser.position.add(laser.userData.velocity);
            
            // Remove laser if it's too far away
            if (laser.position.distanceTo(this.camera.position) > 1000) {
                this.scene.remove(laser);
                this.lasers.splice(i, 1);
            }
        }
    }

    updateFlightControls() {
        if (!this.xwing) return;

        // Calculate forward direction based on current rotation
        this.direction.set(0, 0, -1);
        this.direction.applyQuaternion(this.xwing.quaternion);

        // Thrust control (Q)
        if (this.keys['q']) {
            // Add velocity in the direction we're facing
            this.velocity.addScaledVector(this.direction, this.acceleration);
        }

        // Brake (E)
        if (this.keys['e']) {
            this.velocity.multiplyScalar(0.95); // Reduce velocity by 5%
        }

        // Apply drag to slow down naturally
        this.velocity.multiplyScalar(this.drag);

        // Clamp velocity magnitude
        const speed = this.velocity.length();
        if (speed > this.maxSpeed) {
            this.velocity.multiplyScalar(this.maxSpeed / speed);
        }

        // Apply pitch (W/S)
        if (this.keys['w']) this.rotation.x -= this.pitchSpeed;
        if (this.keys['s']) this.rotation.x += this.pitchSpeed;

        // Apply yaw (A/D)
        if (this.keys['a']) this.rotation.y += this.yawSpeed;
        if (this.keys['d']) this.rotation.y -= this.yawSpeed;

        // Apply roll (Z/C)
        if (this.keys['z']) this.rotation.z += this.rollSpeed;
        if (this.keys['c']) this.rotation.z -= this.rollSpeed;

        // Update position based on velocity
        this.xwing.position.add(this.velocity);

        // Update rotation with smooth interpolation
        this.xwing.rotation.x += (this.rotation.x - this.xwing.rotation.x) * this.smoothing;
        this.xwing.rotation.y += (this.rotation.y - this.xwing.rotation.y) * this.smoothing;
        this.xwing.rotation.z += (this.rotation.z - this.xwing.rotation.z) * this.smoothing;

        // Update camera to follow X-Wing with lag
        const idealOffset = new THREE.Vector3(0, 3, 15);
        const idealLookat = new THREE.Vector3(0, 0, -10);
        
        // Convert ideal offset to world space
        const matrix = new THREE.Matrix4();
        matrix.extractRotation(this.xwing.matrix);
        
        const offset = idealOffset.clone();
        offset.applyMatrix4(matrix);
        offset.add(this.xwing.position);
        
        const lookat = idealLookat.clone();
        lookat.applyMatrix4(matrix);
        lookat.add(this.xwing.position);
        
        // Smooth camera movement
        this.camera.position.lerp(offset, 0.1);
        this.controls.target.lerp(lookat, 0.1);
        
        // Allow camera to rotate freely
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        // Setup camera with better initial position
        this.camera.position.set(0, 3, 15);
        this.camera.lookAt(0, 0, 0);

        // Add orbit controls with enhanced settings
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
        this.controls.enableZoom = false;     // Disable zoom for better control
        this.controls.enablePan = false;      // Disable panning for better control
        this.controls.maxPolarAngle = Math.PI; // Allow full vertical rotation
        this.controls.minPolarAngle = 0;      // Allow full vertical rotation
        this.controls.maxDistance = 20;       // Limit max distance
        this.controls.minDistance = 10;       // Keep minimum distance

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Setup flight controls
        this.setupControls();
    }

    createScene() {
        // Add space background (enhanced star field)
        const starGeometry = new THREE.BufferGeometry();
        const starMaterial = new THREE.PointsMaterial({ 
            color: 0xFFFFFF,
            size: 0.15,
            transparent: true,
            opacity: 1,
            sizeAttenuation: true,
            fog: false
        });
        
        const starVertices = [];
        this.starSpread = 4000;  // Larger spread for more depth
        const starCount = 8000;  // More stars
        const layerCount = 4;    // Multiple layers for parallax effect
        
        // Create stars in layers for better depth effect
        for (let layer = 0; layer < layerCount; layer++) {
            const layerDepth = (layer / layerCount) * this.starSpread - this.starSpread/2;
            const layerStars = Math.floor(starCount / layerCount);
            
            for (let i = 0; i < layerStars; i++) {
                const x = Math.random() * this.starSpread - this.starSpread/2;
                const y = Math.random() * this.starSpread - this.starSpread/2;
                const z = layerDepth + Math.random() * (this.starSpread/layerCount) - this.starSpread/(layerCount*2);
                starVertices.push(x, y, z);
            }
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
        
        // Store original positions for reference
        this.starsData = new Float32Array(starVertices);

        // Enhanced lighting setup
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 2);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.1;
        mainLight.shadow.camera.far = 100;
        mainLight.shadow.bias = -0.0001;
        this.scene.add(mainLight);

        // Add rim light for dramatic effect
        const rimLight = new THREE.DirectionalLight(0x0044ff, 1);
        rimLight.position.set(-5, 2, -5);
        this.scene.add(rimLight);

        // Add subtle blue fill light
        const fillLight = new THREE.DirectionalLight(0x0044ff, 0.3);
        fillLight.position.set(0, -5, 0);
        this.scene.add(fillLight);

        // Load X-Wing model
        this.loadXWingModel();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // Update model scale when window is resized
        if (this.xwing) {
            const newScale = this.calculateResponsiveScale();
            this.xwing.scale.set(newScale, newScale, newScale);
        }
    }

    loadXWingModel() {
        // Show loading message with style
        const loadingDiv = document.createElement('div');
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.color = '#FFE81F'; // Star Wars yellow
        loadingDiv.style.fontSize = '24px';
        loadingDiv.style.fontFamily = 'Arial, sans-serif';
        loadingDiv.style.textShadow = '0 0 10px rgba(255, 232, 31, 0.5)';
        loadingDiv.textContent = 'Loading X-Wing model...';
        this.container.appendChild(loadingDiv);

        this.loader.load(
            '/static/models/X-wing.glb',
            (gltf) => {
                this.xwing = gltf.scene;
                
                // Reset X-Wing position and rotation (facing away from camera)
                this.xwing.position.set(0, 0, 0);
                this.xwing.rotation.set(0, 0, 0);  // Changed from Math.PI to 0 to face away
                this.xwing.quaternion.setFromEuler(this.xwing.rotation);
                
                // Apply responsive scaling
                const scale = this.calculateResponsiveScale();
                this.xwing.scale.set(scale, scale, scale);
                
                // Add the model to the scene
                this.scene.add(this.xwing);
                
                // Reset camera and controls
                this.camera.position.set(0, 3, 15);
                this.camera.lookAt(0, 0, 0);
                
                // Reset velocity and rotation
                this.velocity.set(0, 0, 0);
                this.rotation.set(0, 0, 0);  // Changed from Math.PI to 0 to face away
                
                // Center orbit controls
                this.controls.target.set(0, 0, 0);
                this.controls.update();
                
                // Add shadows
                this.xwing.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // Enhance material
                        if (child.material) {
                            child.material.metalness = 0.7;
                            child.material.roughness = 0.3;
                        }
                    }
                });
                
                // Remove loading message
                loadingDiv.remove();
            },
            (xhr) => {
                const progress = (xhr.loaded / xhr.total) * 100;
                loadingDiv.textContent = `Loading X-Wing model... ${Math.round(progress)}%`;
            },
            (error) => {
                console.error('Error loading X-Wing model:', error);
                loadingDiv.textContent = 'Error loading X-Wing model';
                // Fall back to placeholder model
                const geometry = new THREE.ConeGeometry(0.5, 1, 4);
                const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                this.xwing = new THREE.Mesh(geometry, material);
                this.scene.add(this.xwing);
            }
        );
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();

        // Update star positions
        if (this.stars && this.xwing) {
            // Get the positions attribute
            const positions = this.stars.geometry.attributes.position.array;
            
            // Update each star position
            for (let i = 0; i < positions.length; i += 3) {
                // Move stars relative to ship velocity
                positions[i + 2] -= this.velocity.z;

                // Wrap stars when they go too far behind
                if (positions[i + 2] < -this.starSpread/2) {
                    positions[i + 2] += this.starSpread;
                }
                // Wrap stars when they go too far ahead
                else if (positions[i + 2] > this.starSpread/2) {
                    positions[i + 2] -= this.starSpread;
                }
            }

            // Flag the attribute for update
            this.stars.geometry.attributes.position.needsUpdate = true;
        }

        // Update flight controls
        this.updateFlightControls();

        // Update lasers
        this.updateLasers();

        // Fire lasers with spacebar
        if (this.keys[' ']) {
            this.fireLasers();
        }

        // Apply engine glow effect based on thrust
        if (this.xwing && this.keys[' ']) {
            // Add thrust visual feedback here in the future
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Game();
});
