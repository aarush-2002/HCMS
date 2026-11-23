import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface PublicStats {
  totalCount: number;
  resolvedCount: number;
  emergencyCount: number;
  hostelCount: number;
  resolvedPercentage: number;
}

export const HostelCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<PublicStats>({
    totalCount: 0,
    resolvedCount: 0,
    emergencyCount: 0,
    hostelCount: 1,
    resolvedPercentage: 0,
  });
  const [webGlSupported, setWebGlSupported] = useState(true);

  // Fetch real public aggregate stats
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/public/stats');
        if (res.ok) {
          const data: PublicStats = await res.json();
          if (isMounted) setStats(data);
        }
      } catch {
        // Fallback gracefully to subtle baseline if API not yet populated
      }
    };
    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

  // Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Feature check for WebGL
    try {
      const testCanvas = document.createElement('canvas');
      const gl =
        testCanvas.getContext('webgl') ||
        testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    // 2. Motion preference check
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    // 3. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    // Calculate sky background tint based on resolved percentage ("daybreak")
    // From deep night (#05070a) to subtle dawn tint (#0c1322)
    const dawnFactor = Math.min(1, Math.max(0, stats.resolvedPercentage / 100));
    const nightSky = new THREE.Color(0x05070a);
    const dawnSky = new THREE.Color(0x0f1826);
    const currentSky = nightSky.clone().lerp(dawnSky, dawnFactor * 0.7);

    scene.background = currentSky;
    scene.fog = new THREE.FogExp2(currentSky, 0.018);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    camera.position.set(0, 5, 26);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Starfield (Twinkling particles)
    const starCount = window.innerWidth < 768 ? 200 : 500;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starTwinkleSpeeds = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 100;
      starPositions[i * 3 + 1] = Math.random() * 35 + 2; // Sky upper half
      starPositions[i * 3 + 2] = -Math.random() * 60 - 10;
      starTwinkleSpeeds[i] = Math.random() * 2 + 0.5;
    }

    starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(starPositions, 3)
    );

    const starMaterial = new THREE.PointsMaterial({
      color: 0xdfe7e0,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // 5. Warm Glowing Moon
    const moonGroup = new THREE.Group();
    const moonGeo = new THREE.SphereGeometry(2.4, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff3cf });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(moonMesh);

    // Moon halo glow
    const haloGeo = new THREE.RingGeometry(2.4, 4.2, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xf5a524,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    moonGroup.add(haloMesh);

    moonGroup.position.set(16, 14, -25);
    scene.add(moonGroup);

    // 6. Layered Hostel Block Silhouette & Windows
    // Foreground and background buildings
    const buildingGroup = new THREE.Group();

    // Building materials
    const buildingMatFar = new THREE.MeshBasicMaterial({ color: 0x070b10 });
    const buildingMatMid = new THREE.MeshBasicMaterial({ color: 0x090e16 });
    const windowMatLit = new THREE.MeshBasicMaterial({ color: 0xf5a524 }); // Amber resolved
    const windowMatUnlit = new THREE.MeshBasicMaterial({
      color: 0x121a24,
      transparent: true,
      opacity: 0.85,
    });

    // Background distant hostel blocks (no windows, soft silhouette)
    const farBlock1 = new THREE.Mesh(
      new THREE.BoxGeometry(16, 14, 2),
      buildingMatFar
    );
    farBlock1.position.set(-18, 5, -12);
    buildingGroup.add(farBlock1);

    const farBlock2 = new THREE.Mesh(
      new THREE.BoxGeometry(20, 16, 2),
      buildingMatFar
    );
    farBlock2.position.set(15, 6, -14);
    buildingGroup.add(farBlock2);

    // Midground Main Hostel Block (West & East Wings)
    const totalWindows = 60;
    // Determine how many windows should be lit amber based on real resolved data
    // If 0 total complaints exist in system, show 15% lit as default quiet night baseline
    const effectivePercentage =
      stats.totalCount > 0 ? stats.resolvedPercentage : 20;
    const litWindowsTarget = Math.round(
      (effectivePercentage / 100) * totalWindows
    );

    let currentWindowIndex = 0;

    // Wing Left (4 floors x 6 columns = 24 windows)
    const wingLeft = new THREE.Mesh(
      new THREE.BoxGeometry(14, 13, 3),
      buildingMatMid
    );
    wingLeft.position.set(-9, 4, -4);
    buildingGroup.add(wingLeft);

    const winGeo = new THREE.PlaneGeometry(0.7, 1.1);

    for (let floor = 0; floor < 4; floor++) {
      for (let col = 0; col < 6; col++) {
        currentWindowIndex++;
        const isLit = currentWindowIndex <= litWindowsTarget;
        const winMesh = new THREE.Mesh(
          winGeo,
          isLit ? windowMatLit : windowMatUnlit
        );
        winMesh.position.set(
          -9 - 5 + col * 2,
          1 + floor * 2.4,
          -2.4
        );
        buildingGroup.add(winMesh);
      }
    }

    // Wing Right (5 floors x 7 columns = 35 windows)
    const wingRight = new THREE.Mesh(
      new THREE.BoxGeometry(17, 16, 3),
      buildingMatMid
    );
    wingRight.position.set(8, 5.5, -3);
    buildingGroup.add(wingRight);

    for (let floor = 0; floor < 5; floor++) {
      for (let col = 0; col < 7; col++) {
        currentWindowIndex++;
        const isLit = currentWindowIndex <= litWindowsTarget;
        const winMesh = new THREE.Mesh(
          winGeo,
          isLit ? windowMatLit : windowMatUnlit
        );
        winMesh.position.set(
          8 - 6 + col * 2,
          0.5 + floor * 2.4,
          -1.4
        );
        buildingGroup.add(winMesh);
      }
    }

    scene.add(buildingGroup);

    // 7. Ambient ground plane to ground the silhouettes
    const groundGeo = new THREE.PlaneGeometry(100, 20);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x040608 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, -2.5, 0);
    groundMesh.rotation.x = -Math.PI / 2;
    scene.add(groundMesh);

    // 8. Parallax interaction (mouse pointer and scroll)
    let targetX = 0;
    let targetY = 5;
    let currentX = 0;
    let currentY = 5;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      targetX = normX * 1.8;
      targetY = 5 + normY * 1.2;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      // Soft vertical parallax as page scrolls down
      targetY = 5 - (scrollY / window.innerHeight) * 2.5;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Handle Window Resize
    const handleResize = () => {
      if (!renderer || !camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 9. Animation Loop (Performance optimized)
    let animationFrameId: number;
    let isTabVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible && !prefersReducedMotion) {
        animate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const animate = () => {
      if (!isTabVisible) return;

      // Smooth camera interpolation
      currentX += (targetX - currentX) * 0.04;
      currentY += (targetY - currentY) * 0.04;
      camera.position.x = currentX;
      camera.position.y = currentY;
      camera.lookAt(0, 6, 0);

      // Subtle twinkling on star opacity
      const time = Date.now() * 0.001;
      starMaterial.opacity = 0.65 + Math.sin(time * 1.5) * 0.15;

      renderer.render(scene, camera);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    // If reduced motion is requested, render once and don't loop
    if (prefersReducedMotion) {
      camera.position.set(0, 5, 26);
      camera.lookAt(0, 6, 0);
      renderer.render(scene, camera);
    } else {
      animate();
    }

    // Cleanup
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
      renderer.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [stats]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {webGlSupported ? (
        <div ref={containerRef} className="w-full h-full" />
      ) : (
        // Graceful CSS Fallback when WebGL is unavailable
        <div className="w-full h-full bg-[#05070a] relative">
          <div className="absolute top-12 right-24 w-20 h-20 rounded-full bg-[#fff4d4] shadow-[0_0_50px_rgba(245,165,36,0.3)]" />
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-[#090e16] flex items-end justify-center gap-12">
            <div className="w-64 h-40 bg-[#0c121c] border-t border-[rgba(223,231,224,0.1)] relative grid grid-cols-5 gap-2 p-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 rounded-sm ${
                    i < 6 ? 'bg-[#f5a524]' : 'bg-[#141c2b]'
                  }`}
                />
              ))}
            </div>
            <div className="w-72 h-48 bg-[#0b1019] border-t border-[rgba(223,231,224,0.1)] relative grid grid-cols-6 gap-2 p-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-4 rounded-sm ${
                    i < 8 ? 'bg-[#f5a524]' : 'bg-[#141c2b]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostelCanvas;
