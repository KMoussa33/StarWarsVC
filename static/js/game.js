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
        this.keys = {};
        this.maxSpeed = 2.0;           // Increased max speed
        this.acceleration = 0.03;      // Faster acceleration
        this.deceleration = 0.015;      // Adjusted deceleration
        this.rotationSpeed = 0.05;     // Faster rotation
        this.smoothing = 0.15;         // Rotation smoothing factor

        // Death Star properties
        this.deathStarRadius = 1500;    // Even larger radius for better visibility at distance
        this.deathStarSegments = 128;   // High detail sphere
        this.trenchWidth = 20;          // Wider trench for better visibility
        this.trenchDepth = 15;          // Deeper trench
        this.surfaceDetail = 1.0;        // High surface detail

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
            A/D - Roll left/right<br>
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

        // Thrust control (Q)
        if (this.keys['q']) {
            this.velocity.z -= this.acceleration;
        }

        // Brake (E)
        if (this.keys['e']) {
            this.velocity.z += this.deceleration * 2;
        }

        // Natural deceleration
        this.velocity.z += this.velocity.z > 0 ? -this.deceleration : this.deceleration;

        // Clamp velocity
        this.velocity.z = Math.max(Math.min(this.velocity.z, this.maxSpeed), -this.maxSpeed);

        // Apply pitch (W/S)
        if (this.keys['w']) this.rotation.x -= this.rotationSpeed;
        if (this.keys['s']) this.rotation.x += this.rotationSpeed;

        // Apply roll (A/D)
        if (this.keys['a']) this.rotation.z += this.rotationSpeed;
        if (this.keys['d']) this.rotation.z -= this.rotationSpeed;

        // Update position
        this.xwing.position.z += this.velocity.z;

        // Update rotation with smooth interpolation
        this.xwing.rotation.x += (this.rotation.x - this.xwing.rotation.x) * this.smoothing;
        this.xwing.rotation.y += (this.rotation.y - this.xwing.rotation.y) * this.smoothing;
        this.xwing.rotation.z += (this.rotation.z - this.xwing.rotation.z) * this.smoothing;
        
        // No banking effect needed without yaw

        // Update camera position to follow X-Wing with lag
        const cameraTargetZ = this.xwing.position.z + 15;
        this.camera.position.z += (cameraTargetZ - this.camera.position.z) * 0.1;
        
        // Update camera target with slight lag for smoother following
        const targetPosition = this.xwing.position.clone();
        this.controls.target.lerp(targetPosition, 0.1);
        
        // Add slight camera tilt during roll
        if (this.keys['a']) this.camera.position.y += (2 - this.camera.position.y) * 0.05;
        if (this.keys['d']) this.camera.position.y += (-2 - this.camera.position.y) * 0.05;
        if (!this.keys['a'] && !this.keys['d']) this.camera.position.y += (0 - this.camera.position.y) * 0.05;
    }

    init() {
        // Setup renderer with improved shadows
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Setup camera with improved positioning and far plane for distant Death Star
        this.camera.position.set(0, 10, 30);
        this.camera.far = 20000;
        this.camera.updateProjectionMatrix();

        // Setup controls with better constraints
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 2000;
        this.controls.minDistance = 10;
        this.controls.maxPolarAngle = Math.PI * 0.8; // Prevent going too far below
        this.controls.minPolarAngle = Math.PI * 0.2; // Prevent going too far above

        // Create Death Star
        this.createDeathStar();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Setup flight controls
        this.setupControls();
    }

    createDeathStar() {
        // Create main sphere geometry
        const geometry = new THREE.SphereGeometry(this.deathStarRadius, this.deathStarSegments, this.deathStarSegments);
        
        // Create base material
        const material = new THREE.MeshPhongMaterial({
            color: 0x808080,
            shininess: 10,
            bumpScale: 0.5
        });

        // Create noise texture for surface details
        const textureSize = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = textureSize;
        canvas.height = textureSize;
        const ctx = canvas.getContext('2d');

        // Generate noise pattern
        for (let y = 0; y < textureSize; y++) {
            for (let x = 0; x < textureSize; x++) {
                const value = Math.random() * 255;
                ctx.fillStyle = `rgb(${value},${value},${value})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        material.bumpMap = texture;

        // Create Death Star mesh
        this.deathStar = new THREE.Mesh(geometry, material);
        this.deathStar.position.set(0, 0, -this.deathStarRadius * 8); // Positioned much further ahead
        this.deathStar.rotation.x = Math.PI * 0.1; // Slight tilt to show trench
        this.scene.add(this.deathStar);

        // Add slight fog for distance perception
        this.scene.fog = new THREE.Fog(0x000000, this.deathStarRadius * 4, this.deathStarRadius * 8);

        // Add ambient occlusion effect
        const aoMap = new THREE.TextureLoader().load('/static/textures/noise.png');
        material.aoMap = aoMap;
        material.aoMapIntensity = 1.0;

        // Enhance material properties
        material.metalness = 0.7;
        material.roughness = 0.6;

        // Create superlaser dish
        this.createSuperlaser();

        // Create equatorial trench
        this.createTrench();
    }

    createSuperlaser() {
        // Create the main dish
        const dishGeometry = new THREE.CircleGeometry(this.deathStarRadius * 0.15, 64);
        const dishMaterial = new THREE.MeshPhongMaterial({
            color: 0x222222,
            side: THREE.DoubleSide,
            emissive: 0x004400,
            emissiveIntensity: 2,
            metalness: 0.9,
            roughness: 0.3
        });

        const dish = new THREE.Mesh(dishGeometry, dishMaterial);
        dish.position.copy(this.deathStar.position);
        dish.position.x += this.deathStarRadius;
        dish.rotation.y = Math.PI / 2;

        // Add concentric rings
        const rings = 5;
        for (let i = 0; i < rings; i++) {
            const ringGeometry = new THREE.RingGeometry(
                (this.deathStarRadius * 0.1) * (i / rings),
                (this.deathStarRadius * 0.1) * ((i + 1) / rings),
                32
            );
            const ringMaterial = new THREE.MeshPhongMaterial({
                color: 0x666666,
                side: THREE.DoubleSide,
                emissive: 0x003300
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.position.copy(dish.position);
            ring.rotation.y = Math.PI / 2;
            this.scene.add(ring);
        }

        this.scene.add(dish);
    }

    createTrench() {
        // Create the equatorial trench
        const trenchGeometry = new THREE.BoxGeometry(
            this.deathStarRadius * 2,
            this.trenchWidth,
            this.trenchDepth
        );
        const trenchMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        const trench = new THREE.Mesh(trenchGeometry, trenchMaterial);
        
        trench.position.copy(this.deathStar.position);
        this.scene.add(trench);

        // Add trench details
        const detailCount = 50;
        for (let i = 0; i < detailCount; i++) {
            const detailGeometry = new THREE.BoxGeometry(
                this.trenchWidth,
                this.trenchWidth,
                this.trenchDepth
            );
            const detail = new THREE.Mesh(detailGeometry, trenchMaterial);
            
            // Position along the trench
            const angle = (i / detailCount) * Math.PI * 2;
            detail.position.copy(this.deathStar.position);
            detail.position.x += Math.cos(angle) * this.deathStarRadius;
            detail.position.z += Math.sin(angle) * this.deathStarRadius;
            
            // Rotate to face center
            detail.lookAt(this.deathStar.position);
            
            this.scene.add(detail);
        }
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
        for(let i = 0; i < 2000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starVertices.push(x, y, z);
        }
        
        starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);

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
                
                // Apply responsive scaling
                const scale = this.calculateResponsiveScale();
                this.xwing.scale.set(scale, scale, scale);
                this.xwing.position.set(0, 0, 0); // Center position
                
                // Rotate model to face forward
                this.xwing.rotation.set(0, Math.PI, 0);
                
                // Add the model to the scene
                this.scene.add(this.xwing);
                
                // Setup better camera position - further back for better view
                this.camera.position.set(0, 5, 30);
                this.camera.lookAt(this.xwing.position);
                
                // Adjust orbit controls
                this.controls.target.copy(this.xwing.position);
                this.controls.minDistance = 5;
                this.controls.maxDistance = 100;
                
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

        // Animate stars slightly
        if (this.stars) {
            this.stars.rotation.y += delta * 0.05;
        }

        // Rotate Death Star slowly
        if (this.deathStar) {
            this.deathStar.rotation.y += delta * 0.02;
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
        if (this.xwing && this.keys['q']) {
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
