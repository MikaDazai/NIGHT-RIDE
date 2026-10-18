import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Stars } from '@react-three/drei';
import * as THREE from 'three';
import './style.css';

type YouTubePlayerApi = {
  playVideo(): void; loadVideoById(videoId: string): void; getPlayerState(): number; pauseVideo(): void; setVolume(volume: number): void; unMute(): void; mute(): void; destroy(): void;
};
type YouTubePlayerEvent = { target: YouTubePlayerApi; data: number };
type YouTubeApi = { Player: new (element: HTMLIFrameElement, options: { events: { onReady: (event: YouTubePlayerEvent) => void; onStateChange: (event: YouTubePlayerEvent) => void; onAutoplayBlocked?: () => void; onError?: () => void } }) => YouTubePlayerApi };
declare global { interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void } }

type RideState = { speed: number; steer: number; lateralVelocity: number; distance: number; throttle: boolean; brake: boolean; autoRide: boolean };
type BikeType = 'Sport' | 'Naked' | 'Touring' | 'Retro';
type Motorcycle = { id: string; name: string; category: BikeType; topSpeed: number; acceleration: number; braking: number; steering: number; color: string; description: string };
const motorcycleCatalog: Motorcycle[] = [
  { id: 'apex-r', name: 'Apex R', category: 'Sport', topSpeed: 230, acceleration: 52, braking: 104, steering: 1, color: '#b13b58', description: 'Track-bred fairings and razor sharp response.' },
  { id: 'vortex-9', name: 'Vortex 9', category: 'Sport', topSpeed: 242, acceleration: 58, braking: 108, steering: .96, color: '#486fba', description: 'Long nose, high-rev power and planted high speed.' },
  { id: 'nightblade', name: 'Nightblade', category: 'Sport', topSpeed: 220, acceleration: 49, braking: 112, steering: 1.08, color: '#8b64b5', description: 'Compact carbon bodywork with quick, precise turns.' },
  { id: 'streetfighter', name: 'Streetfighter', category: 'Naked', topSpeed: 205, acceleration: 50, braking: 100, steering: 1.16, color: '#d07a37', description: 'Wide bars, exposed frame and immediate throttle.' },
  { id: 'urban-twin', name: 'Urban Twin', category: 'Naked', topSpeed: 188, acceleration: 44, braking: 96, steering: 1.2, color: '#3e9a8d', description: 'Light city roadster with nimble steering.' },
  { id: 'torque-800', name: 'Torque 800', category: 'Naked', topSpeed: 198, acceleration: 54, braking: 102, steering: 1.04, color: '#a9aeb5', description: 'Muscular twin-cylinder pull and a broad stance.' },
  { id: 'grand-tour', name: 'Grand Tour', category: 'Touring', topSpeed: 200, acceleration: 39, braking: 92, steering: .78, color: '#467b88', description: 'Wind protection and calm long-distance handling.' },
  { id: 'atlas-gt', name: 'Atlas GT', category: 'Touring', topSpeed: 210, acceleration: 42, braking: 96, steering: .82, color: '#a64d46', description: 'Sport touring bodywork with extra cruising pace.' },
  { id: 'horizon-cruiser', name: 'Horizon Cruiser', category: 'Touring', topSpeed: 175, acceleration: 35, braking: 88, steering: .72, color: '#c2a66b', description: 'Low seat, broad luggage and relaxed road manners.' },
  { id: 'cafe-racer', name: 'Cafe Racer', category: 'Retro', topSpeed: 180, acceleration: 38, braking: 90, steering: 1.1, color: '#b0a276', description: 'Clip-ons, a slim seat and classic proportions.' },
  { id: 'classic-500', name: 'Classic 500', category: 'Retro', topSpeed: 160, acceleration: 31, braking: 84, steering: 1.06, color: '#7c9a75', description: 'Round-lamp single with gentle, unhurried power.' },
  { id: 'scrambler-650', name: 'Scrambler 650', category: 'Retro', topSpeed: 172, acceleration: 40, braking: 89, steering: 1.14, color: '#c5793e', description: 'Raised stance, block tires and a lively upright feel.' },
];
const laneMarkOffsets = [-10, -6, -2];
type BikeProps = { ride: React.MutableRefObject<RideState>; cameraMode: 'chase' | 'cockpit'; color: string; bikeType: BikeType; bikeModelId: string; quality: string };

function Bike({ ride, cameraMode, color, bikeType, bikeModelId, quality }: BikeProps) {
  const root = useRef<THREE.Group>(null);
  const front = useRef<THREE.Group>(null);
  const wheelFront = useRef<THREE.Mesh>(null);
  const wheelBack = useRef<THREE.Mesh>(null);
  const exhaustGlow = useRef<THREE.Mesh>(null);
  const bodyColor = useMemo(() => new THREE.Color(color), [color]);
  const panelColor = useMemo(() => new THREE.Color('#34404d'), []);
  const modelVariant = Math.max(0, motorcycleCatalog.findIndex(model => model.id === bikeModelId)) % 3;
  // Each model gets a distinct wheelbase/stance as well as its category silhouette.
  const frontWheelZ = [-.82, -.92, -1.02][modelVariant];
  const rearWheelZ = [.57, .67, .77][modelVariant];
  const barHeight = [.84, .91, .99][modelVariant];
  const beamTarget = useMemo(() => { const target = new THREE.Object3D(); target.position.set(0, .1, -30); return target; }, []);
  useFrame((_, dt) => {
    if (!root.current) return;
    const s = ride.current;
    root.current.position.x = THREE.MathUtils.damp(root.current.position.x, s.steer, 8, dt);
    root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, -s.lateralVelocity * .035, 5, dt);
    root.current.position.y = 0.035 + Math.sin(s.distance * 0.23) * Math.min(0.018, s.speed / 10000);
    if (front.current) front.current.rotation.y = -s.steer * 0.22;
    const spin = s.speed * dt * 0.18;
    if (wheelFront.current) wheelFront.current.rotation.y -= spin;
    if (wheelBack.current) wheelBack.current.rotation.y -= spin;
    if (exhaustGlow.current) exhaustGlow.current.visible = s.brake && s.speed > 30 && Math.sin(s.distance * 2.7) > .78;
  });
  const dark = '#252d37';
  return <group ref={root} position={[0, 0, 0]}>
    <primitive object={beamTarget} />
    {quality !== 'Low' && <spotLight position={[0, 1.02, -.78]} target={beamTarget} angle={.46} penumbra={.78} intensity={115} distance={48} color="#d5e5ff" />}
    <mesh position={[0, .024, .12]} rotation={[-Math.PI / 2, 0, 0]} scale={[.58, 1.12, 1]}><circleGeometry args={[1, 32]} /><meshBasicMaterial color="#02050a" transparent opacity={.4} depthWrite={false} /></mesh>
    <mesh ref={exhaustGlow} position={[0, .58, 1.02]} rotation={[Math.PI / 2, 0, 0]} visible={false}><coneGeometry args={[.055, .24, 8]} /><meshBasicMaterial color="#55baff" toneMapped={false} /></mesh>
    <mesh ref={wheelBack} position={[0, .39, rearWheelZ]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.34, .34, .24, 24]} /><meshStandardMaterial color="#202832" roughness={.52} /></mesh>
    <mesh position={[0, .39, rearWheelZ + .36]}><circleGeometry args={[.32, 24]} /><meshStandardMaterial color="#26313c" emissive="#17212b" emissiveIntensity={.35} metalness={.12} roughness={.78} /></mesh>
    <mesh position={[0, .39, rearWheelZ + .37]}><torusGeometry args={[.205, .026, 8, 24]} /><meshStandardMaterial color="#8493a2" metalness={.75} roughness={.28} /></mesh>
    <mesh position={[0, .39, rearWheelZ + .375]}><circleGeometry args={[.075, 16]} /><meshStandardMaterial color="#aab7c3" metalness={.72} roughness={.25} /></mesh>
    <mesh ref={wheelFront} position={[0, .39, frontWheelZ]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.34, .34, .24, 24]} /><meshStandardMaterial color="#28333e" roughness={.52} /></mesh>
    <mesh position={[0, .4, .67]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.22, .22, .18, 16]} /><meshStandardMaterial color="#9aa6b3" metalness={.85} roughness={.25} /></mesh>
    <mesh position={[0, .4, frontWheelZ]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.17, .17, .18, 16]} /><meshStandardMaterial color="#9aa6b3" metalness={.85} roughness={.25} /></mesh>
    <mesh position={[0, .72, .43]} rotation={[.38, 0, 0]}><dodecahedronGeometry args={[.31, 1]} /><meshStandardMaterial color="#566575" emissive="#263543" emissiveIntensity={.42} metalness={.62} roughness={.32} /></mesh>
    {/* Sculpted fairings and exposed mechanical details give each silhouette more depth. */}
    <mesh position={[0, .79, -.47]} rotation={[modelVariant === 1 ? Math.PI / 2 - .12 : -.12, 0, 0]} scale={[1, .72 + modelVariant * .08, 1.24 + modelVariant * .12]}>
      {modelVariant === 0 ? <sphereGeometry args={[.34, 20, 14]} /> : modelVariant === 1 ? <coneGeometry args={[.31, .72, 8]} /> : <dodecahedronGeometry args={[.34, 1]} />}
      <meshStandardMaterial color={bodyColor} metalness={.78} roughness={.2} />
    </mesh>
    {modelVariant === 1 && <mesh position={[0, .69, -.83]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.21, .31, .42, 12]} /><meshStandardMaterial color={bodyColor} metalness={.72} roughness={.24} /></mesh>}
    {modelVariant === 2 && <mesh position={[0, .58, .33]} rotation={[0, 0, Math.PI / 2]}><torusGeometry args={[.21, .045, 8, 18]} /><meshStandardMaterial color="#b1c0cd" metalness={.84} roughness={.23} /></mesh>}
    <mesh position={[0, .62, .1]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.19, .23, .42, 16]} /><meshStandardMaterial color="#4a5662" metalness={.82} roughness={.32} /></mesh>
    {[-1, 1].map(side => <React.Fragment key={`engine-${side}`}>
      <mesh position={[side * .2, .67, .13]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.075, .075, .26, 12]} /><meshStandardMaterial color="#4a5662" metalness={.82} roughness={.32} /></mesh>
      <mesh position={[side * .25, .58, .5]} rotation={[.12, 0, side * -.08]}><cylinderGeometry args={[.035, .055, .68, 10]} /><meshStandardMaterial color="#778492" metalness={.9} roughness={.22} /></mesh>
      <mesh position={[side * .48, .72, -.78]} rotation={[0, 0, side * -.22]}><cylinderGeometry args={[.025, .035, .52, 8]} /><meshStandardMaterial color="#778492" metalness={.9} roughness={.22} /></mesh>
      <mesh position={[side * .48, .99, -1.02]} rotation={[-.18, 0, side * .08]}><boxGeometry args={[.23, .13, .1]} /><meshStandardMaterial color="#4a5662" metalness={.82} roughness={.32} /></mesh>
    </React.Fragment>)}
    <mesh position={[0, 1.02, -1.02]}><sphereGeometry args={[.17, 20, 12]} /><meshStandardMaterial color="#e4f3ff" emissive="#b8dcff" emissiveIntensity={5} metalness={.15} roughness={.12} /></mesh>
    <mesh position={[0, bikeType === 'Touring' ? .9 : bikeType === 'Retro' ? .78 : .85, -.2]} rotation={[Math.PI / 2 - .12, 0, 0]}><capsuleGeometry args={[bikeType === 'Touring' ? .22 : bikeType === 'Retro' ? .24 : .17, bikeType === 'Sport' ? .72 : .54, 5, 12]} /><meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={.14} metalness={.68} roughness={.22} /></mesh>
    <mesh position={[0, .61, -.05]} rotation={[Math.PI / 2 + .12, 0, 0]} scale={[1, .82, 1]}><capsuleGeometry args={[.145, .48, 5, 12]} /><meshStandardMaterial color={dark} metalness={.24} roughness={.52} /></mesh>
    {[-1, 1].map(side => <mesh key={side} position={[side * .24, .7, .42]} rotation={[.22, 0, side * .12]}><boxGeometry args={[.2, .3, .35]} /><meshStandardMaterial color={panelColor} metalness={.52} roughness={.34} /></mesh>)}
    <mesh position={[0, .68, .83]}><boxGeometry args={[.38, .18, .18]} /><meshStandardMaterial color="#e94d61" emissive="#9d172d" emissiveIntensity={1.8} /></mesh>
    <mesh position={[0, 1.01, -.72]}><sphereGeometry args={[.18, 16, 10]} /><meshStandardMaterial color="#dceaff" emissive="#9ebcff" emissiveIntensity={3.2} /></mesh>
    <group ref={front} position={[0, barHeight, -.78]}>
      <mesh position={[0, .08, -.22]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.035, .035, .8, 8]} /><meshStandardMaterial color="#aeb7c1" metalness={.8} /></mesh>
      <mesh position={[0, .13, -.25]}><boxGeometry args={[.52, .06, .08]} /><meshStandardMaterial color="#1a2028" metalness={.8} /></mesh>
      {[-1, 1].map(side => <React.Fragment key={`mirror-${side}`}>
        <mesh position={[side * .49, .37, -.12]} rotation={[.35, 0, side * .22]}><cylinderGeometry args={[.018, .025, .34, 8]} /><meshStandardMaterial color="#778492" metalness={.9} roughness={.22} /></mesh>
        <mesh position={[side * .51, .55, -.16]} rotation={[.25, 0, side * .22]} scale={[1.2, .55, .22]}><sphereGeometry args={[.105, 14, 8]} /><meshStandardMaterial color="#aebdcc" metalness={.92} roughness={.14} /></mesh>
        <mesh position={[side * .49, .16, -.18]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.045, .045, .18, 12]} /><meshStandardMaterial color="#161b22" roughness={.74} /></mesh>
      </React.Fragment>)}
      <mesh position={[0, .23, -.23]} rotation={[.22, 0, 0]}><boxGeometry args={[.3, .18, .04]} /><meshStandardMaterial color="#080e15" emissive="#102b42" emissiveIntensity={.55} metalness={.35} roughness={.2} /></mesh>
      {[0, 1, 2, 3, 4].map(i => <mesh key={`rev-${i}`} position={[(i - 2) * .045, .34, -.24]}><boxGeometry args={[.025, .018, .015]} /><meshBasicMaterial color={i < 3 ? '#52d7ba' : '#ff9c63'} toneMapped={false} /></mesh>)}
    </group>
    <mesh position={[0, .92, .37]} rotation={[.16, 0, 0]}><boxGeometry args={[.34, .05, .22]} /><meshStandardMaterial color="#090c11" /></mesh>
    <group visible={cameraMode === 'chase'}>
      <mesh position={[0, .97, .2]} rotation={[-.18, 0, 0]}><capsuleGeometry args={[.145, .2, 5, 10]} /><meshStandardMaterial color="#202833" roughness={.82} /></mesh>
      <mesh position={[0, 1.27, .08]} rotation={[-.24, 0, 0]}><capsuleGeometry args={[.165, .3, 6, 12]} /><meshStandardMaterial color="#252d38" emissive="#10151d" emissiveIntensity={.12} roughness={.78} /></mesh>
      <mesh position={[0, 1.62, -.015]} scale={[1, .94, .92]}><sphereGeometry args={[.165, 18, 14]} /><meshStandardMaterial color="#111a26" emissive="#172638" emissiveIntensity={.18} metalness={.52} roughness={.2} /></mesh>
      <mesh position={[0, 1.62, -.165]} scale={[.76, .48, .32]}><sphereGeometry args={[.12, 16, 10]} /><meshStandardMaterial color="#27445c" metalness={.58} roughness={.16} /></mesh>
      <mesh position={[0, 1.34, -.015]}><boxGeometry args={[.25, .035, .1]} /><meshStandardMaterial color="#91b9dc" emissive="#274660" emissiveIntensity={.65} metalness={.3} roughness={.28} /></mesh>
      {[-1, 1].map(side => <React.Fragment key={side}>
        <mesh position={[side * .26, 1.31, .025]} scale={[1.05, .9, .9]}><sphereGeometry args={[.072, 12, 10]} /><meshStandardMaterial color="#4a5967" roughness={.68} /></mesh>
        <mesh position={[side * .34, 1.2, -.16]} rotation={[-.62, 0, side * .18]}><capsuleGeometry args={[.061, .24, 4, 8]} /><meshStandardMaterial color="#4a5967" roughness={.7} /></mesh>
        <mesh position={[side * .29, 1.03, -.5]} rotation={[-1.08, 0, side * .08]}><capsuleGeometry args={[.057, .29, 4, 8]} /><meshStandardMaterial color="#52616d" roughness={.66} /></mesh>
        <mesh position={[side * .245, .91, -.76]}><sphereGeometry args={[.06, 10, 8]} /><meshStandardMaterial color="#151d26" roughness={.6} /></mesh>
        <mesh position={[side * .245, .72, .04]} rotation={[-2.44, 0, side * .08]}><capsuleGeometry args={[.105, .45, 5, 8]} /><meshStandardMaterial color="#333d48" roughness={.76} /></mesh>
        <mesh position={[side * .3, .46, -.16]} rotation={[0, 0, side * .08]}><boxGeometry args={[.17, .095, .3]} /><meshStandardMaterial color="#111820" roughness={.7} /></mesh>
      </React.Fragment>)}
    </group>
    {bikeType === 'Touring' && <>
      <mesh position={[-.36, .74, .44]}><boxGeometry args={[.3, .4, .42]} /><meshStandardMaterial color={bodyColor} metalness={.45} roughness={.38} /></mesh>
      <mesh position={[.36, .74, .44]}><boxGeometry args={[.3, .4, .42]} /><meshStandardMaterial color={bodyColor} metalness={.45} roughness={.38} /></mesh>
      <mesh position={[0, 1.16, -.62]} rotation={[-.2, 0, 0]}><boxGeometry args={[.5, .32, .05]} /><meshStandardMaterial color="#8ea3ba" transparent opacity={.35} roughness={.15} /></mesh>
    </>}
    {bikeType === 'Retro' && <>
      <mesh position={[0, .99, -.76]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.22, .035, 8, 20]} /><meshStandardMaterial color="#c5a86b" metalness={.8} roughness={.2} /></mesh>
      <mesh position={[0, .74, -.22]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.055, .055, .54, 12]} /><meshStandardMaterial color="#b5a27d" metalness={.6} roughness={.35} /></mesh>
    </>}
    {bikeType === 'Naked' && <mesh position={[0, 1.08, -.62]}><boxGeometry args={[.32, .13, .18]} /><meshStandardMaterial color="#252d35" metalness={.6} roughness={.3} /></mesh>}
    {bikeType === 'Sport' && <>
      {[-1, 1].map(side => <React.Fragment key={`sport-cowl-${side}`}>
        <mesh position={[side * .31, .73, -.58]} rotation={[0, 0, side * -.16]} scale={[.78, 1, 1.35]}><dodecahedronGeometry args={[.28, 1]} /><meshStandardMaterial color={bodyColor} metalness={.82} roughness={.19} /></mesh>
        <mesh position={[side * .24, .66, -.99]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.085, .14, .36, 8]} /><meshStandardMaterial color="#111923" metalness={.45} roughness={.32} /></mesh>
      </React.Fragment>)}
      <mesh position={[0, .66, .92]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[.18, .46, 7]} /><meshStandardMaterial color={bodyColor} metalness={.78} roughness={.2} /></mesh>
      <mesh position={[0, 1.08, -.67]} rotation={[-.18, 0, 0]}><boxGeometry args={[.3, .2, .12]} /><meshStandardMaterial color="#182330" transparent opacity={.72} metalness={.36} roughness={.14} /></mesh>
    </>}
    {bikeType === 'Naked' && <>
      {[-1, 1].map(side => <React.Fragment key={`frame-${side}`}>
        <mesh position={[side * .22, .79, -.19]} rotation={[.12, 0, side * -.51]}><cylinderGeometry args={[.025, .025, .63, 6]} /><meshStandardMaterial color={color} metalness={.72} roughness={.3} /></mesh>
        <mesh position={[side * .22, .59, .14]} rotation={[0, 0, side * .48]}><cylinderGeometry args={[.024, .024, .58, 6]} /><meshStandardMaterial color={color} metalness={.72} roughness={.3} /></mesh>
        <mesh position={[side * .31, .65, -.56]} rotation={[0, 0, side * -.18]}><boxGeometry args={[.16, .36, .25]} /><meshStandardMaterial color="#4a5662" metalness={.78} roughness={.38} /></mesh>
      </React.Fragment>)}
      <mesh position={[0, 1.05, -.76]}><boxGeometry args={[.46, .09, .12]} /><meshStandardMaterial color="#222a33" metalness={.55} roughness={.4} /></mesh>
    </>}
    {bikeType === 'Touring' && <>
      <mesh position={[0, 1.05, -.72]} rotation={[-.12, 0, 0]}><dodecahedronGeometry args={[.39, 1]} /><meshStandardMaterial color={bodyColor} metalness={.7} roughness={.25} /></mesh>
      {[-1, 1].map(side => <mesh key={`tour-case-${side}`} position={[side * .66, .77, .39]} rotation={[0, 0, side * -.04]}><boxGeometry args={[.36, .49, .64]} /><meshStandardMaterial color={bodyColor} metalness={.68} roughness={.28} /></mesh>)}
      <mesh position={[0, 1.29, -.66]} rotation={[-.12, 0, 0]}><boxGeometry args={[.58, .5, .055]} /><meshStandardMaterial color="#a8c3da" transparent opacity={.27} metalness={.32} roughness={.12} /></mesh>
    </>}
    {bikeType === 'Retro' && <>
      <mesh position={[0, 1.02, -1.04]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.235, .045, 10, 24]} /><meshStandardMaterial color="#c7d4df" metalness={.84} roughness={.18} /></mesh>
      {[.67, -.92].map((z, wheelIndex) => Array.from({ length: 10 }, (_, spoke) => {
        const angle = spoke * Math.PI / 10, radius = .21, y = .39 + Math.cos(angle) * radius, spokeZ = z + Math.sin(angle) * radius;
        return <mesh key={`spoke-${wheelIndex}-${spoke}`} position={[0, y, spokeZ]} rotation={[angle, 0, 0]}><cylinderGeometry args={[.008, .008, radius * 2, 5]} /><meshStandardMaterial color="#9facb7" metalness={.9} roughness={.22} /></mesh>;
      }))}
      <mesh position={[0, .79, .24]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.085, .085, .58, 12]} /><meshStandardMaterial color="#b5a27d" metalness={.7} roughness={.28} /></mesh>
      <mesh position={[0, .95, -.25]}><boxGeometry args={[.37, .1, .4]} /><meshStandardMaterial color="#181b1e" roughness={.78} /></mesh>
    </>}
    {cameraMode === 'cockpit' && <mesh position={[0, 1.13, -.5]} rotation={[.16, 0, 0]}><boxGeometry args={[.38, .12, .08]} /><meshStandardMaterial color="#161d27" metalness={.6} /></mesh>}
  </group>;
}

function placeInstance(mesh: THREE.InstancedMesh | null, index: number, x: number, y: number, z: number, dummy: THREE.Object3D) {
  if (!mesh) return;
  dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
}

function Road({ ride, environment, weather, quality }: { ride: React.MutableRefObject<RideState>; environment: string; weather: string; quality: string }) {
  const segmentRefs = useRef<(THREE.Group | null)[]>([]);
  const batchRoot = useRef<THREE.Group>(null);
  const propsRoot = useRef<THREE.Group>(null);
  const asphaltTiles = useRef<THREE.InstancedMesh>(null);
  const guardrails = useRef<THREE.InstancedMesh>(null);
  const shoulderStrips = useRef<THREE.InstancedMesh>(null);
  const centerMarks = useRef<THREE.InstancedMesh>(null);
  const sideMarks = useRef<THREE.InstancedMesh>(null);
  const lampMasts = useRef<THREE.InstancedMesh>(null);
  const lampHeads = useRef<THREE.InstancedMesh>(null);
  const treeTrunks = useRef<THREE.InstancedMesh>(null);
  const forestCanopies = useRef<THREE.InstancedMesh>(null);
  const cityCanopies = useRef<THREE.InstancedMesh>(null);
  const segmentLength = 12;
  const asphaltTexture = useMemo(() => {
    const size = 128, data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) { const grain = 28 + Math.random() * 24; const offset = i * 4; data[offset] = grain; data[offset + 1] = grain + 2; data[offset + 2] = grain + 5; data[offset + 3] = 255; }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(5, 3); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
    return texture;
  }, []);
  const asphaltGeometry = useMemo(() => new THREE.BoxGeometry(21, .18, segmentLength), []);
  const railGeometry = useMemo(() => new THREE.BoxGeometry(.3, .52, segmentLength), []);
  const shoulderGeometry = useMemo(() => new THREE.BoxGeometry(.05, .012, segmentLength), []);
  const centerMarkGeometry = useMemo(() => new THREE.BoxGeometry(.11, .018, 2.2), []);
  const sideMarkGeometry = useMemo(() => new THREE.BoxGeometry(.075, .018, 2.2), []);
  const centerMarkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e3d4bc', emissive: '#879bad', emissiveIntensity: .2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), []);
  const sideMarkMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c7d1d7', emissive: '#879bad', emissiveIntensity: .2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), []);
  // 804 m ahead plus 60 m behind gives the camera a long, pre-generated ring buffer.
  const segments = useMemo(() => Array.from({ length: 72 }, (_, i) => ({ z: 60 - i * segmentLength, seed: i })), []);
  const batchZ = useMemo(() => segments.map(segment => segment.z), [segments]);
  const batchActive = useMemo(() => Array.from({ length: segments.length }, () => false), [segments]);
  const batchInitialized = useRef(false);
  const lamps = useMemo(() => Array.from({ length: 140 }, (_, i) => ({ z: -i * 6 - 5, side: i % 2 ? -1 : 1 })), []);
  const trees = useMemo(() => Array.from({ length: 180 }, (_, i) => ({ z: -(i * 5 + 2), side: i % 2 ? -1 : 1, h: 2.1 + (i * 17 % 9) / 10 })), []);
  const lampZ = useMemo(() => lamps.map(lamp => lamp.z), [lamps]);
  const treeZ = useMemo(() => trees.map(tree => tree.z), [trees]);
  const lampActive = useMemo(() => Array.from({ length: lamps.length }, () => false), [lamps]);
  const treeActive = useMemo(() => Array.from({ length: trees.length }, () => false), [trees]);
  const propsInitialized = useRef(false);
  const treeMode = useRef('');
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    // Recycle each prebuilt tile/prop only after it has passed well behind the camera.
    const travel = ride.current.speed * dt * .12;
    const aheadBuffer = THREE.MathUtils.clamp(600 + ride.current.speed * .9, 600, 800);
    if (batchRoot.current) batchRoot.current.position.z += travel;
    if (propsRoot.current) propsRoot.current.position.z += travel;
    for (const segment of segmentRefs.current) if (segment) {
      segment.position.z += travel;
      if (segment.position.z > 72) segment.position.z -= segments.length * segmentLength;
      segment.visible = segment.position.z >= -aheadBuffer - segmentLength && segment.position.z <= 72;
    }
    let instanceMatricesDirty = !batchInitialized.current;
    for (let i = 0; i < segments.length; i++) {
      let z = batchZ[i] + (batchRoot.current?.position.z ?? 0), recycled = false;
      if (z > 72) { batchZ[i] -= segments.length * segmentLength; z -= segments.length * segmentLength; recycled = true; }
      const active = z >= -aheadBuffer - segmentLength && z <= 72;
      if (recycled || active !== batchActive[i] || !batchInitialized.current) {
        const localZ = batchZ[i], y = active ? 0 : -1000;
        placeInstance(asphaltTiles.current, i, 0, active ? -.04 : y, localZ - 5.5, dummy);
        for (let side = 0; side < 2; side++) {
          const sign = side === 0 ? -1 : 1, index = i * 2 + side;
          placeInstance(guardrails.current, index, sign * 10.75, active ? .2 : y, localZ - 5.5, dummy);
          placeInstance(shoulderStrips.current, index, sign * 10.48, active ? .012 : y, localZ - 5.5, dummy);
        }
        for (let mark = 0; mark < 3; mark++) {
          const markZ = localZ + laneMarkOffsets[mark];
          placeInstance(centerMarks.current, i * 3 + mark, 0, active ? .082 : y, markZ, dummy);
          placeInstance(sideMarks.current, i * 6 + mark, -5, active ? .082 : y, markZ, dummy);
          placeInstance(sideMarks.current, i * 6 + 3 + mark, 5, active ? .082 : y, markZ, dummy);
        }
        batchActive[i] = active;
        instanceMatricesDirty = true;
      }
    }
    batchInitialized.current = true;
    if (instanceMatricesDirty) for (const mesh of [asphaltTiles.current, guardrails.current, shoulderStrips.current, centerMarks.current, sideMarks.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    const forest = environment === 'Forest Highway' || environment === 'Mountain Pass';
    const nextTreeMode = forest ? `forest:${environment}` : 'city';
    const treeModeChanged = treeMode.current !== nextTreeMode;
    treeMode.current = nextTreeMode;
    let lampDirty = !propsInitialized.current, treeDirty = !propsInitialized.current || treeModeChanged;
    for (let i = 0; i < lamps.length; i++) {
      let z = lampZ[i] + (propsRoot.current?.position.z ?? 0), recycled = false;
      if (z > 72) { lampZ[i] -= lamps.length * 6; z -= lamps.length * 6; recycled = true; }
      const active = z >= -aheadBuffer;
      if (recycled || active !== lampActive[i] || !propsInitialized.current) {
        const lamp = lamps[i], localZ = lampZ[i], y = active ? 0 : -1000;
        dummy.position.set(lamp.side * 11.8, active ? 2.8 : y, localZ); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); lampMasts.current?.setMatrixAt(i, dummy.matrix);
        dummy.position.set(lamp.side * 11.05, active ? 5.58 : y, localZ); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, lamp.side * .1); dummy.updateMatrix(); lampHeads.current?.setMatrixAt(i, dummy.matrix);
        lampActive[i] = active; lampDirty = true;
      }
    }
    for (let i = 0; i < trees.length; i++) {
      let z = treeZ[i] + (propsRoot.current?.position.z ?? 0), recycled = false;
      if (z > 72) { treeZ[i] -= trees.length * 5; z -= trees.length * 5; recycled = true; }
      const tree = trees[i], x = tree.side * (13 + (i % 4) * .8), inBuffer = z >= -aheadBuffer;
      if (recycled || inBuffer !== treeActive[i] || treeModeChanged || !propsInitialized.current) {
        const localZ = treeZ[i], visibleForest = forest && inBuffer, visibleCity = !forest && inBuffer;
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(x, visibleForest ? tree.h * .48 : -1000, localZ); dummy.scale.set(1, visibleForest ? tree.h : 0, 1); dummy.updateMatrix(); treeTrunks.current?.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, visibleForest ? tree.h * 1.05 : -1000, localZ); dummy.scale.set(visibleForest ? .7 + tree.h * .12 : 0, visibleForest ? tree.h * 1.15 : 0, visibleForest ? .7 + tree.h * .12 : 0); dummy.updateMatrix(); forestCanopies.current?.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, visibleCity ? .9 + i % 4 : -1000, localZ); dummy.scale.set(visibleCity ? 1.2 : 0, visibleCity ? 2 + i % 4 : 0, visibleCity ? 1.2 : 0); dummy.updateMatrix(); cityCanopies.current?.setMatrixAt(i, dummy.matrix);
        treeActive[i] = inBuffer; treeDirty = true;
      }
    }
    if (lampDirty) { if (lampMasts.current) lampMasts.current.instanceMatrix.needsUpdate = true; if (lampHeads.current) lampHeads.current.instanceMatrix.needsUpdate = true; }
    if (treeDirty) for (const mesh of [treeTrunks.current, forestCanopies.current, cityCanopies.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
    propsInitialized.current = true;
  });
  const isCity = environment === 'Neon City';
  const isCoast = environment === 'Coastal Road';
  const rain = weather.includes('Rain') || weather === 'Thunderstorm';
  const asphaltMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: asphaltTexture, color: rain ? '#647484' : '#737e8c', roughness: quality === 'Low' ? .94 : rain ? .22 : .86, metalness: quality === 'Low' ? .02 : rain ? .26 : .12, emissive: rain && quality !== 'Low' ? '#101d2e' : '#000000', emissiveIntensity: rain && quality !== 'Low' ? .32 : 0 }), [asphaltTexture, rain, quality]);
  const railMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#505963', metalness: .7, roughness: .4 }), []);
  const shoulderMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c5d2dc', emissive: '#7394b5', emissiveIntensity: rain ? .5 : .12 }), [rain]);
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.08, -560]}><planeGeometry args={[260, 1200]} /><meshStandardMaterial color={isCoast ? '#101c28' : '#0b1118'} roughness={1} /></mesh>
    <group ref={batchRoot}>
      <instancedMesh ref={asphaltTiles} args={[asphaltGeometry, asphaltMaterial, segments.length]} frustumCulled={false} />
      <instancedMesh ref={guardrails} args={[railGeometry, railMaterial, segments.length * 2]} frustumCulled={false} />
      <instancedMesh ref={shoulderStrips} args={[shoulderGeometry, shoulderMaterial, segments.length * 2]} frustumCulled={false} />
      <instancedMesh ref={centerMarks} args={[centerMarkGeometry, centerMarkMaterial, segments.length * 3]} frustumCulled={false} />
      <instancedMesh ref={sideMarks} args={[sideMarkGeometry, sideMarkMaterial, segments.length * 6]} frustumCulled={false} />
    </group>
    {segments.map(({ z, seed }, index) => <group key={seed} ref={node => { segmentRefs.current[index] = node; }} position={[0, 0, z]}>
      {isCity && <mesh position={[(seed % 2 ? 1 : -1) * (14 + seed % 5), 3.3, -12]}><boxGeometry args={[2.6, 6.6 + seed % 5, 2.4]} /><meshStandardMaterial color="#101b2b" emissive={seed % 3 ? '#07172b' : '#31184b'} emissiveIntensity={.45} /></mesh>}
      {isCity && seed % 4 === 1 && <group position={[seed % 2 ? -12.5 : 12.5, 0, -8]}>
        <mesh position={[0, 2.2, 0]}><cylinderGeometry args={[.045, .07, 4.4, 6]} /><meshStandardMaterial color="#363c48" metalness={.7} /></mesh>
        <mesh position={[0, 4.35, 0]}><boxGeometry args={[2.8, 1.25, .16]} /><meshStandardMaterial color="#121a2a" emissive={seed % 3 ? '#17364e' : '#4c174a'} emissiveIntensity={1.4} metalness={.36} roughness={.3} /></mesh>
        <mesh position={[0, 4.35, -.1]}><boxGeometry args={[2.45, .035, .03]} /><meshBasicMaterial color={seed % 2 ? '#69d9ea' : '#ed82bb'} toneMapped={false} /></mesh>
      </group>}
      {environment === 'Mountain Pass' && seed % 3 === 0 && <group position={[0, 0, -11]}>
        <mesh position={[-19, 4.3 + seed % 4, -6]}><coneGeometry args={[8 + seed % 3, 14 + seed % 5, 7]} /><meshStandardMaterial color="#131c2a" roughness={1} /></mesh>
        <mesh position={[20, 5 + seed % 5, -10]}><coneGeometry args={[10 + seed % 4, 17 + seed % 6, 8]} /><meshStandardMaterial color="#172231" roughness={1} /></mesh>
      </group>}
      {isCoast && <mesh position={[0, -1.4, -5.5]}><boxGeometry args={[45, 2.5, 12]} /><meshStandardMaterial color="#112638" /></mesh>}
    </group>)}
    <group ref={propsRoot}>
      <instancedMesh ref={lampMasts} args={[undefined, undefined, lamps.length]}>
        <cylinderGeometry args={[.045, .07, 5.6, 7]} /><meshStandardMaterial color="#343a43" metalness={.7} />
      </instancedMesh>
      <instancedMesh ref={lampHeads} args={[undefined, undefined, lamps.length]}>
        <boxGeometry args={[1.5, .1, .18]} /><meshStandardMaterial color="#c5d8ff" emissive="#9abaff" emissiveIntensity={3.4} />
      </instancedMesh>
      {(() => {
      const forest = environment === 'Forest Highway' || environment === 'Mountain Pass';
      return <>
        <instancedMesh ref={treeTrunks} args={[undefined, undefined, trees.length]} visible={forest}>
          <cylinderGeometry args={[.12, .22, 1, 5]} /><meshStandardMaterial color="#17191c" />
        </instancedMesh>
        <instancedMesh ref={forestCanopies} args={[undefined, undefined, trees.length]} visible={forest}>
          <coneGeometry args={[1, 1, 6]} /><meshStandardMaterial color={environment === 'Mountain Pass' ? '#151c27' : '#101c1b'} roughness={1} />
        </instancedMesh>
        <instancedMesh ref={cityCanopies} args={[undefined, undefined, trees.length]} visible={!forest}>
          <boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="#101827" emissive="#101627" emissiveIntensity={.2} />
        </instancedMesh>
      </>;
      })()}
    </group>
  </group>;
}

function World({ ride, cameraMode, color, bikeType, bikeModelId, environment, weather, timeOfDay, quality, fpsReadout }: BikeProps & { environment: string; weather: string; timeOfDay: string; fpsReadout: React.MutableRefObject<HTMLDivElement | null> }) {
  const { gl } = useThree();
  const camera = useRef<THREE.PerspectiveCamera>(null);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const lightning = useRef<THREE.PointLight>(null);
  const flash = useRef(0);
  const frameStats = useRef({ frames: 0, seconds: 0 });
  const fogColor = weather === 'Fog' ? '#536273' : timeOfDay === 'Blue hour' ? '#172d49' : timeOfDay === 'Sunset' ? '#513743' : '#080812';
  useFrame((_, dt) => {
    frameStats.current.frames++;
    frameStats.current.seconds += dt;
    if (frameStats.current.seconds >= .75) {
      if (fpsReadout.current) fpsReadout.current.textContent = `${Math.round(frameStats.current.frames / frameStats.current.seconds)} FPS · ${gl.info.render.calls} draw calls`;
      frameStats.current.frames = 0; frameStats.current.seconds = 0;
    }
    const c = camera.current;
    if (!c) return;
    const bikeX = ride.current.steer;
    const chase = cameraMode === 'chase';
    lookTarget.set(bikeX - ride.current.lateralVelocity * (chase ? .018 : .006), (chase ? 2.55 : 1.47) + Math.sin(ride.current.distance * .42) * Math.min(.009, ride.current.speed / 18000), chase ? 6.4 : -.24);
    c.position.lerp(lookTarget, 1 - Math.exp(-dt * 3.2));
    c.lookAt(bikeX, chase ? .88 : 1.32, chase ? -5.5 : -16);
    c.fov = THREE.MathUtils.damp(c.fov, 67 + ride.current.speed * .11, 2, dt);
    // Speed increases the visible pre-generated horizon; fog hides the pool's distant boundary.
    c.far = quality === 'Low' ? 440 : THREE.MathUtils.clamp(620 + ride.current.speed * .9, 620, 830);
    c.updateProjectionMatrix();
    if(weather==='Thunderstorm' && Math.random()<dt*.025) flash.current=1.2;
    flash.current=Math.max(0,flash.current-dt*3.2);
    if(lightning.current) lightning.current.intensity=flash.current*24;
  });
  return <>
    <PerspectiveCamera ref={camera} makeDefault position={[0, 2.35, 5.8]} fov={67} near={.1} far={830} />
    <color attach="background" args={[fogColor]} />
    <fogExp2 attach="fog" args={[fogColor, weather === 'Fog' ? .017 : quality === 'Low' ? .012 : .008]} />
    <ambientLight intensity={timeOfDay === 'Sunrise' ? .56 : .34} color={timeOfDay === 'Sunset' ? '#ffb99c' : '#9bb5da'} />
    <hemisphereLight args={['#253957', '#0a0c10', .48]} />
    <directionalLight position={[-8, 12, -18]} intensity={timeOfDay === 'Sunrise' ? 1.2 : .24} color={timeOfDay === 'Sunrise' ? '#ffd7ac' : '#99b7f5'} />
    <directionalLight position={[0, 5, 5]} intensity={.72} color="#a9c5e8" />
    <pointLight ref={lightning} position={[0, 16, -34]} color="#9fc9ff" intensity={0} distance={100} decay={1.5} />
    <Stars radius={110} depth={48} count={quality === 'Low' ? 350 : quality === 'Medium' ? 850 : 1400} factor={2.2} saturation={.15} fade speed={.12} />
    <Road ride={ride} environment={environment} weather={weather} quality={quality} />
    <Bike key={bikeModelId} ride={ride} cameraMode={cameraMode} color={color} bikeType={bikeType} bikeModelId={bikeModelId} quality={quality} />
    {weather.includes('Rain') || weather === 'Thunderstorm' ? <Rain ride={ride} intensity={(weather === 'Light Rain' ? 1 : 1.9) * (quality === 'Low' ? .5 : quality === 'Medium' ? .75 : 1)} /> : null}
  </>;
}
function Rain({ ride, intensity }: { ride: React.MutableRefObject<RideState>; intensity: number }) {
  const ref = useRef<THREE.Points>(null);
  const elapsed = useRef(0);
  const particleData = useMemo(() => {
    const count = Math.round(700 * intensity), positions = new Float32Array(count * 3);
    const fallSpeeds = new Float32Array(count), drift = new Float32Array(count), phase = new Float32Array(count), sway = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - .5) * 30;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = -45 + Math.random() * 53;
      fallSpeeds[i] = 13 + Math.random() * 13;
      drift[i] = (Math.random() - .5) * 2.6;
      phase[i] = Math.random() * Math.PI * 2;
      sway[i] = .12 + Math.random() * .5;
    }
    return { positions, fallSpeeds, drift, phase, sway };
  }, [intensity]);
  useFrame((_, dt) => {
    const p = ref.current; if (!p) return;
    elapsed.current += dt;
    const arr = p.geometry.attributes.position.array as Float32Array;
    const speed = ride.current.speed;
    p.position.x = ride.current.steer;
    for (let i = 0; i < particleData.fallSpeeds.length; i++) {
      const j = i * 3, wind = speed * .012;
      arr[j + 1] -= (particleData.fallSpeeds[i] + speed * .18) * dt;
      arr[j] += (particleData.drift[i] + wind + Math.sin(elapsed.current * 1.7 + particleData.phase[i]) * particleData.sway[i]) * dt;
      arr[j + 2] += (speed * .1 + Math.cos(elapsed.current * 1.15 + particleData.phase[i]) * .24) * dt;
      if (arr[j + 1] < 0) {
        arr[j] = (Math.random() - .5) * 30;
        arr[j + 1] = 15 + Math.random() * 15;
        arr[j + 2] = -45 + Math.random() * 53;
        particleData.fallSpeeds[i] = 13 + Math.random() * 13;
        particleData.drift[i] = (Math.random() - .5) * 2.6;
        particleData.phase[i] = Math.random() * Math.PI * 2;
        particleData.sway[i] = .12 + Math.random() * .5;
      }
    }
    p.geometry.attributes.position.needsUpdate = true;
  });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[particleData.positions, 3]} /></bufferGeometry><pointsMaterial color="#b9d5ff" size={.045} transparent opacity={.52} depthWrite={false} /></points>;
}

type TrafficSnapshot = { x: number; z: number; opposing: boolean }[];
function Traffic({ ride, density, audioContext, masterGain, environmentVolume, trafficSnapshot, quality }: { ride: React.MutableRefObject<RideState>; density: 'Off' | 'Low' | 'Medium' | 'High'; audioContext: React.MutableRefObject<AudioContext | null>; masterGain: React.MutableRefObject<GainNode | null>; environmentVolume: number; trafficSnapshot: React.MutableRefObject<TrafficSnapshot>; quality: string }) {
  const requestedCount = density === 'Off' ? 0 : density === 'Low' ? 3 : density === 'Medium' ? 6 : 10;
  const count = quality === 'Low' ? Math.min(requestedCount, 3) : quality === 'Medium' ? Math.min(requestedCount, 6) : requestedCount;
  const groups = useRef<THREE.Group[]>([]);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wheel = useMemo(() => new THREE.CylinderGeometry(.28, .28, .16, 10), []);
  const darkGlass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#101923', metalness: .38, roughness: .25 }), []);
  const headlights = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d8e8ff', emissive: '#a9ccff', emissiveIntensity: 4 }), []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ed3f4c', emissive: '#ff1829', emissiveIntensity: 3 }), []);
  const palette = ['#667786', '#7b554d', '#59616b', '#8a8a80', '#46596b'];
  const bodyMaterials = useMemo(() => palette.map(color => new THREE.MeshStandardMaterial({ color, metalness: .45, roughness: .38 })), []);
  const tireMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#11151a', roughness: .9 }), []);
  const chromeMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8797a8', metalness: .86, roughness: .24 }), []);
  const grilleMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111820', metalness: .42, roughness: .5 }), []);
  const models = useMemo(() => Array.from({ length: count }, (_, i) => ({ lane: i % 2 === 0 ? 2.5 + (Math.floor(i / 2) % 2) * 5 : -2.5 - (Math.floor(i / 2) % 2) * 5, z: -22 - (i * 19) % 115, speed: i % 2 === 0 ? 55 + (i * 13) % 65 : 78 + (i * 11) % 40, length: i % 11 === 10 ? 6.2 : i % 5 === 4 ? 4.4 : i % 3 === 2 ? 3.9 : 3.5, color: palette[i % palette.length], opposing: i % 2 === 1 })), [count]);
  const currentSpeeds = useRef<number[]>([]);
  if (currentSpeeds.current.length !== models.length) currentSpeeds.current = models.map(car => car.speed);
  const snapshot = useMemo(() => Array.from({ length: count }, () => ({ x: 0, z: 0, opposing: false })), [count]);
  useFrame((_, dt) => {
    trafficSnapshot.current = snapshot;
    models.forEach((car, i) => {
      const group = groups.current[i];
      if (!group) return;
      const previousZ = group.position.z;
      // In the road-relative coordinate system, same-direction traffic ahead has a
      // smaller Z. Match its speed as the gap closes and clamp the minimum bumper gap.
      let targetSpeed = car.speed;
      let nearestLead: { z: number; speed: number; minGap: number } | null = null;
      for (let otherIndex = 0; otherIndex < models.length; otherIndex++) {
        const other = models[otherIndex];
        if (otherIndex === i || other.opposing !== car.opposing || Math.abs(other.lane - car.lane) > .01) continue;
        const otherGroup = groups.current[otherIndex];
        if (!otherGroup) continue;
        const gap = group.position.z - otherGroup.position.z;
        if (gap > 0 && gap < 30 && (!nearestLead || gap < group.position.z - nearestLead.z)) {
          nearestLead = { z: otherGroup.position.z, speed: currentSpeeds.current[otherIndex] ?? other.speed, minGap: (car.length + other.length) * .5 + 1.8 };
        }
      }
      if (nearestLead && group.position.z - nearestLead.z < 26) targetSpeed = Math.min(targetSpeed, nearestLead.speed);
      currentSpeeds.current[i] = THREE.MathUtils.damp(currentSpeeds.current[i] ?? car.speed, targetSpeed, 2.8, dt);
      const effectiveSpeed = currentSpeeds.current[i];
      const relative = car.opposing ? ride.current.speed + effectiveSpeed : ride.current.speed - effectiveSpeed;
      let nextZ = group.position.z + relative * .12 * dt;
      if (nearestLead && nextZ < nearestLead.z + nearestLead.minGap) nextZ = nearestLead.z + nearestLead.minGap;
      group.position.z = nextZ;
      if (previousZ <= 0 && group.position.z > 0 && audioContext.current && environmentVolume > .01) {
        const context = audioContext.current, now = context.currentTime;
        const pan = context.createStereoPanner(), filter = context.createBiquadFilter(), gain = context.createGain(), tone = context.createOscillator();
        pan.pan.value = THREE.MathUtils.clamp(car.lane / 12, -1, 1); filter.type = 'lowpass'; filter.frequency.value = 520;
        tone.type = 'sine'; tone.frequency.setValueAtTime(118 + Math.min(90, relative * .35), now); tone.frequency.exponentialRampToValueAtTime(72, now + .85);
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(environmentVolume * .006, now + .12); gain.gain.exponentialRampToValueAtTime(.0001, now + .95);
        tone.connect(filter).connect(gain).connect(pan).connect(masterGain.current ?? context.destination); tone.start(now); tone.stop(now + .8);
      }
      if (group.position.z > 7 || group.position.z < -142) group.position.z = -98 - (i % 5) * 8;
      snapshot[i].x = group.position.x; snapshot[i].z = group.position.z; snapshot[i].opposing = car.opposing;
      if (group.position.z > -.8 && group.position.z < 1.3 && Math.abs(group.position.x - ride.current.steer) < 1.35 && ride.current.speed > 12) {
        ride.current.speed *= .58;
        group.position.z = -105 - i * 2;
      }
    });
  });
  return <>{models.map((car, i) => <group key={`${density}-${i}`} ref={el => { if (el) groups.current[i] = el; }} position={[car.lane, 0, car.z]} rotation={[0, car.opposing ? Math.PI : 0, 0]}>
    {/* Lamp groups are located at bumper height and aimed down the car's local forward axis. */}
    <mesh geometry={box} position={[0, car.length > 5 ? 1.05 : .72, 0]} scale={[car.length > 5 ? 2.15 : 1.65, car.length > 5 ? 1.6 : 1.15, car.length]} material={bodyMaterials[i % bodyMaterials.length]} />
    {car.length > 5 && <mesh geometry={box} position={[0, 1.88, .18]} scale={[1.92, 1.35, car.length * .62]} material={bodyMaterials[(i + 2) % bodyMaterials.length]} />}
    <mesh geometry={box} position={[0, car.length > 5 ? 1.63 : 1.12, -.28]} scale={[car.length > 5 ? 1.65 : 1.35, .72, car.length * .43]} material={darkGlass} />
    <mesh geometry={box} position={[0, .62, -car.length * .53]} scale={[.72, .28, .07]} material={grilleMaterial} />
    <mesh geometry={box} position={[0, .35, -car.length * .53]} scale={[1.78, .12, .12]} material={chromeMaterial} />
    <mesh geometry={box} position={[0, .35, car.length * .53]} scale={[1.78, .12, .12]} material={chromeMaterial} />
    {[-1, 1].map(side => <React.Fragment key={side}>
      <mesh geometry={wheel} position={[side * .78, .3, -car.length * .3]} rotation={[0, 0, Math.PI / 2]} material={tireMaterial} />
      <mesh geometry={wheel} position={[side * .78, .3, car.length * .3]} rotation={[0, 0, Math.PI / 2]} material={tireMaterial} />
      <mesh geometry={box} position={[side * .53, .52, -car.length * .51]} scale={[.28, .18, .07]} material={headlights} />
      <mesh geometry={box} position={[side * .53, .52, car.length * .51]} scale={[.28, .2, .07]} material={tail} />
      <mesh geometry={wheel} position={[side * .78, .3, -car.length * .3]} rotation={[0, 0, Math.PI / 2]} scale={[.42, .55, .42]} material={chromeMaterial} />
      <mesh geometry={wheel} position={[side * .78, .3, car.length * .3]} rotation={[0, 0, Math.PI / 2]} scale={[.42, .55, .42]} material={chromeMaterial} />
    </React.Fragment>)}
  </group>)}</>;
}

type MusicGenre = 'Lo-Fi' | 'Synthwave' | 'Phonk';
const youtubeTracks: Record<MusicGenre, { id: string; title: string }> = {
  'Lo-Fi': { id: 'CBSlu_VMS9U', title: 'JAZZ LOFI MIX — LOFI GIRL' },
  Phonk: { id: '_xUxFLEP6gc', title: 'PHONK · YOUTUBE STREAM' },
  Synthwave: { id: '7d6rzXVlbjg', title: 'SYNTHWAVE · YOUTUBE STREAM' },
};
function createLofiLoop(context: AudioContext, initialGenre: MusicGenre, output: AudioNode = context.destination) {
  const bus = context.createGain();
  const filter = context.createBiquadFilter();
  const genreCutoff = (value: MusicGenre) => value === 'Lo-Fi' ? 1250 : value === 'Synthwave' ? 1550 : 1050;
  filter.type = 'lowpass'; filter.frequency.value = genreCutoff(initialGenre); filter.Q.value = .45; bus.gain.value = 0;
  filter.connect(bus).connect(output);
  const chords = [[130.81, 155.56, 196, 233.08], [110, 130.81, 164.81, 196], [116.54, 146.83, 174.61, 220], [98, 123.47, 146.83, 185]];
  let chord = 0;
  const voices = [0, 1, 2, 3].map((i) => {
    const osc = context.createOscillator(), gain = context.createGain();
    osc.type = i === 0 ? 'triangle' : 'sine'; osc.frequency.value = chords[0][i]; gain.gain.value = 0;
    osc.connect(gain).connect(filter); osc.start(); return { osc, gain };
  });
  const crackleBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const crackleData = crackleBuffer.getChannelData(0);
  for (let i = 0; i < crackleData.length; i++) crackleData[i] = (Math.random() * 2 - 1) * .13;
  const crackle = context.createBufferSource(), crackleFilter = context.createBiquadFilter(), crackleGain = context.createGain();
  crackle.buffer = crackleBuffer; crackle.loop = true; crackleFilter.type = 'lowpass'; crackleFilter.frequency.value = 950; crackleGain.gain.value = .0015;
  crackle.connect(crackleFilter).connect(crackleGain).connect(filter); crackle.start();
  const playChord = () => {
    const now = context.currentTime, notes = chords[chord++ % chords.length];
    voices.forEach(({ osc, gain }, i) => {
      osc.frequency.setTargetAtTime(notes[i], now, 1.1);
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(i === 0 ? .042 : .027, now, 1.4);
      gain.gain.setTargetAtTime(i === 0 ? .034 : .022, now + 5.1, 1.8);
    });
  };
  playChord(); const timer = window.setInterval(playChord, 7000);
  return { bus, setGenre: (value: MusicGenre) => { filter.frequency.setTargetAtTime(genreCutoff(value), context.currentTime, 2.4); }, stop: () => { window.clearInterval(timer); crackle.stop(); voices.forEach(({ osc }) => osc.stop()); } };
}

function App() {
  const ride = useRef<RideState>({ speed: 0, steer: 0, lateralVelocity: 0, distance: 0, throttle: false, brake: false, autoRide: false });
  const speedReadout = useRef<HTMLSpanElement>(null);
  const speedMeter = useRef<HTMLElement>(null);
  const engineLoadReadout = useRef<HTMLElement>(null);
  const [cameraMode, setCameraMode] = useState<'chase' | 'cockpit'>('chase');
  const [screen, setScreen] = useState<'menu' | 'ride' | 'pause' | 'settings'>('menu');
  const [settingsReturn, setSettingsReturn] = useState<'ride' | 'menu'>('menu');
  const [hud, setHud] = useState(true);
  const [environment, setEnvironment] = useState('Neon City');
  const [weather, setWeather] = useState('Light Rain');
  const [timeOfDay, setTimeOfDay] = useState('Deep night');
  const [quality, setQuality] = useState('Medium');
  const fpsDebug = useMemo(() => new URLSearchParams(window.location.search).get('debug') === 'fps', []);
  const fpsReadout = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState('#b13b58');
  const [bikeType, setBikeType] = useState<BikeType>('Sport');
  const [bikeModelId, setBikeModelId] = useState('apex-r');
  const [autoRide, setAutoRide] = useState(false);
  const [autoNotice, setAutoNotice] = useState('');
  const autoNoticeTimer = useRef<number | null>(null);
  const trafficRef = useRef<TrafficSnapshot>([]);
  const selectedBike = motorcycleCatalog.find(model => model.id === bikeModelId) ?? motorcycleCatalog[0];
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [displayLoad, setDisplayLoad] = useState(0);
  const [musicOn, setMusicOn] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [audioStatus, setAudioStatus] = useState<'locked' | 'ready' | 'unavailable'>('locked');
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);
  const [youtubeState, setYoutubeState] = useState<'loading' | 'ready' | 'blocked' | 'error'>('blocked');
  const [youtubePanelOpen, setYoutubePanelOpen] = useState(false);
  const [musicGenre, setMusicGenre] = useState<MusicGenre>('Lo-Fi');
  const [tracks, setTracks] = useState<File[]>([]);
  const [trackIndex, setTrackIndex] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  const [trackTime, setTrackTime] = useState(0);
  const [musicVolume, setMusicVolume] = useState(.7);
  const [masterVolume, setMasterVolume] = useState(.9);
  const [engineVolume, setEngineVolume] = useState(.55);
  const [environmentVolume, setEnvironmentVolume] = useState(.45);
  const musicModeRef = useRef({ musicOn, musicMuted, musicGenre, hasLocalTracks: tracks.length > 0, musicVolume, masterVolume });
  musicModeRef.current = { musicOn, musicMuted, musicGenre, hasLocalTracks: tracks.length > 0, musicVolume, masterVolume };
  const audioRef = useRef<HTMLAudioElement>(null);
  const youtubeFrameRef = useRef<HTMLIFrameElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayerApi | null>(null);
  const youtubeReadyRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const engineOscillatorRef = useRef<OscillatorNode | null>(null);
  const engineGainRef = useRef<GainNode | null>(null);
  const engineNoiseGainRef = useRef<GainNode | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const windFilterRef = useRef<BiquadFilterNode | null>(null);
  const rainGainRef = useRef<GainNode | null>(null);
  const lofiGainRef = useRef<GainNode | null>(null);
  const lofiGenreRef = useRef<(genre: MusicGenre) => void>(() => {});
  const lofiStopRef = useRef<(() => void) | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const youtubeCommand = (func: 'playVideo' | 'pauseVideo' | 'setVolume' | 'unMute' | 'mute', args: (string | number)[] = []) => {
    const player = youtubePlayerRef.current;
    if (player && youtubeReadyRef.current) {
      if (func === 'playVideo') { if (player.getPlayerState() === -1 || player.getPlayerState() === 0) player.loadVideoById(youtubeTracks[musicModeRef.current.musicGenre].id); else player.playVideo(); }
      else if (func === 'pauseVideo') player.pauseVideo();
      else if (func === 'setVolume') player.setVolume(Number(args[0] ?? 70));
      else if (func === 'mute') player.mute();
      else player.unMute();
      return;
    }
    youtubeFrameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
  };
  const requestYoutubePlayback = () => {
    youtubeCommand('setVolume', [Math.round(musicModeRef.current.musicVolume * musicModeRef.current.masterVolume * 100)]);
    if (!musicModeRef.current.musicMuted) youtubeCommand('unMute');
    youtubeCommand('playVideo');
    window.setTimeout(() => {
      const player = youtubePlayerRef.current;
      if (player && youtubeReadyRef.current && ![1, 3].includes(player.getPlayerState())) setYoutubeState('blocked');
    }, 1600);
  };
  const [debugKeys] = useState(() => new URLSearchParams(window.location.search).get('debug') === 'keys');
  const [trafficDensity, setTrafficDensity] = useState<'Off' | 'Low' | 'Medium' | 'High'>('Medium');
  const screenRef = useRef(screen);
  const notifyAuto = (enabled: boolean) => {
    setAutoNotice(enabled ? 'AUTO-RIDE · ON' : 'AUTO-RIDE · OFF');
    if (autoNoticeTimer.current !== null) window.clearTimeout(autoNoticeTimer.current);
    autoNoticeTimer.current = window.setTimeout(() => setAutoNotice(''), 1900);
  };
  const toggleAutoRide = () => { ride.current.autoRide = !ride.current.autoRide; setAutoRide(ride.current.autoRide); notifyAuto(ride.current.autoRide); };
  const actionsRef = useRef({ setScreen, setCameraMode, setHud, setAutoRide, toggleAutoRide });
  screenRef.current = screen;
  actionsRef.current = { setScreen, setCameraMode, setHud, setAutoRide, toggleAutoRide };
  useEffect(() => {
    setYoutubeState('loading');
    const initializePlayer = () => {
      if (!window.YT?.Player || !youtubeFrameRef.current || youtubePlayerRef.current) return;
      youtubePlayerRef.current = new window.YT.Player(youtubeFrameRef.current, { events: {
        onReady: ({ target }) => { youtubePlayerRef.current = target; youtubeReadyRef.current = true; setYoutubeLoaded(true); setYoutubeState('ready'); target.setVolume(Math.round(musicModeRef.current.musicVolume * musicModeRef.current.masterVolume * 100)); if (musicModeRef.current.musicMuted) target.mute(); else target.unMute(); if (musicModeRef.current.musicOn && !musicModeRef.current.hasLocalTracks) requestYoutubePlayback(); },
        onStateChange: ({ data, target }) => { if (data === 1) { if (!musicModeRef.current.hasLocalTracks) { setYoutubeState('ready'); setMusicOn(true); } else target.pauseVideo(); } else if (data === 2) setMusicOn(false); else if (data === 0) { setYoutubeState('blocked'); setMusicOn(true); } },
        onAutoplayBlocked: () => setYoutubeState('blocked'),
        onError: () => { setYoutubeState('error'); setMusicOn(true); },
      } });
    };
    if (window.YT?.Player) initializePlayer();
    else {
      window.onYouTubeIframeAPIReady = initializePlayer;
      if (!document.querySelector('script[data-youtube-iframe-api]')) {
        const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.async = true; script.dataset.youtubeIframeApi = 'true';
        script.onerror = () => setYoutubeState('error'); document.head.appendChild(script);
      }
    }
    return () => { youtubeReadyRef.current = false; youtubePlayerRef.current?.destroy(); youtubePlayerRef.current = null; };
  }, []);
  useEffect(() => {
    if (!youtubePanelOpen || tracks.length || !youtubeReadyRef.current) return;
    const player = youtubePlayerRef.current;
    if (!player) return;
    player.loadVideoById(youtubeTracks[musicGenre].id);
    player.setVolume(Math.round(musicVolume * masterVolume * 100));
    if (musicOn && !musicMuted) player.playVideo();
    else player.pauseVideo();
  }, [musicGenre]);
  useEffect(() => () => { lofiStopRef.current?.(); void audioContextRef.current?.close(); }, []);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('night-ride-settings');
    if (saved) { const x = JSON.parse(saved); const savedBike = motorcycleCatalog.find(model => model.id === x.bikeModelId); setQuality(x.quality ?? 'High'); setTrafficDensity(x.trafficDensity ?? 'Medium'); setEnvironment(x.environment ?? 'Neon City'); setWeather(x.weather ?? 'Light Rain'); setTimeOfDay(x.timeOfDay ?? 'Deep night'); setCameraMode(x.cameraMode ?? 'chase'); setBikeModelId(savedBike?.id ?? 'apex-r'); setBikeType(savedBike?.category ?? x.bikeType ?? 'Sport'); setColor(x.color ?? savedBike?.color ?? '#b13b58'); setMusicGenre((['Lo-Fi','Synthwave','Phonk'].includes(x.musicGenre) ? x.musicGenre : 'Lo-Fi') as MusicGenre); setMusicVolume(x.musicVolume ?? .7); setMasterVolume(x.masterVolume ?? .9); setEngineVolume(x.engineVolume ?? .55); setEnvironmentVolume(x.environmentVolume ?? .45); }
    } catch { /* storage and malformed preferences are optional */ }
  }, []);
  useEffect(() => { try { localStorage.setItem('night-ride-settings', JSON.stringify({ quality, trafficDensity, environment, weather, timeOfDay, cameraMode, color, bikeType, bikeModelId, musicGenre, musicVolume, masterVolume, engineVolume, environmentVolume })); } catch { /* storage can be unavailable */ } }, [quality, trafficDensity, environment, weather, timeOfDay, cameraMode, color, bikeType, bikeModelId, musicGenre, musicVolume, masterVolume, engineVolume, environmentVolume]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Use physical key codes so controls still work with non-US keyboard layouts.
      const k = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.toLowerCase();
      const movement = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
      if (screenRef.current === 'ride' && (movement.includes(k) || k === 'space')) e.preventDefault();
      if (movement.includes(k) && screenRef.current === 'ride') { keysRef.current[k] = true; if (ride.current.autoRide) { ride.current.autoRide = false; actionsRef.current.setAutoRide(false); } }
      if (e.repeat) return;
      if (k === 'c' && screenRef.current === 'ride') actionsRef.current.setCameraMode(v => v === 'chase' ? 'cockpit' : 'chase');
      if (k === 'h' && (screenRef.current === 'ride' || screenRef.current === 'pause')) actionsRef.current.setHud(v => !v);
      if (k === 'p' && screenRef.current === 'ride') actionsRef.current.toggleAutoRide();
      if (k === 'escape') actionsRef.current.setScreen(v => v === 'ride' ? 'pause' : v === 'pause' ? 'ride' : v);
    };
    const up = (e: KeyboardEvent) => { const k = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.code.toLowerCase(); keysRef.current[k] = false; };
    const clear = () => { keysRef.current = {}; };
    window.addEventListener('keydown', down, { passive: false, capture: true }); window.addEventListener('keyup', up, true);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let objectUrl = '';
    if (tracks.length) {
      objectUrl = URL.createObjectURL(tracks[trackIndex]);
      audio.src = objectUrl;
      audio.volume = musicVolume * masterVolume;
    } else {
      audio.src = '';
      audio.pause();
    }
    audio.muted = musicMuted;
    if (tracks.length && musicOn) void audio.play().catch(() => setMusicOn(false)); else if (tracks.length) audio.pause();
    if (lofiGainRef.current) lofiGainRef.current.gain.setTargetAtTime(musicOn && !musicMuted && !tracks.length && (!youtubePanelOpen || youtubeState === 'blocked' || youtubeState === 'error') ? musicVolume * .72 : 0, audioContextRef.current?.currentTime ?? 0, .8);
    if (!tracks.length && youtubeReadyRef.current && youtubePlayerRef.current) {
      youtubeCommand('setVolume', [Math.round(musicVolume * masterVolume * 100)]);
      youtubeCommand(musicMuted ? 'mute' : 'unMute');
      if (musicOn && !musicMuted) {
        youtubeCommand('playVideo');
      } else {
        youtubeCommand('pauseVideo');
      }
    }
    return () => {
      audio.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [tracks, trackIndex, musicOn, musicMuted, musicVolume, masterVolume, musicGenre, youtubePanelOpen, youtubeLoaded, youtubeState]);
  useEffect(() => {
    const now = audioContextRef.current?.currentTime ?? 0;
    masterGainRef.current?.gain.setTargetAtTime(masterVolume, now, .12);
    if (audioRef.current && tracks.length) audioRef.current.volume = musicVolume * masterVolume;
    if (youtubeReadyRef.current || youtubeFrameRef.current) {
      youtubeCommand('setVolume', [Math.round(musicVolume * masterVolume * 100)]);
      youtubeCommand(musicMuted ? 'mute' : 'unMute');
    }
  }, [musicVolume, masterVolume, tracks, musicMuted]);
  const startAudio=()=>{
    try {
      const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!audioContextRef.current) {
        if (!Ctx) { setAudioStatus('unavailable'); return; }
        const context = new Ctx(); audioContextRef.current = context;
        const master = context.createGain(); master.gain.value = masterVolume; master.connect(context.destination); masterGainRef.current = master;
        const lofi = createLofiLoop(context, musicGenre, master); lofiGainRef.current = lofi.bus; lofiStopRef.current = lofi.stop; lofiGenreRef.current = lofi.setGenre;
        const oscillator=context.createOscillator(), engineFilter=context.createBiquadFilter(), engineGain=context.createGain();
        oscillator.type='triangle'; oscillator.frequency.value=48; engineFilter.type='lowpass'; engineFilter.frequency.value=190; engineGain.gain.value=engineVolume*.034;
        oscillator.connect(engineFilter).connect(engineGain).connect(master); oscillator.start();
        const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate), data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
        const noise=context.createBufferSource(); noise.buffer=buffer; noise.loop=true;
        const engineNoiseFilter=context.createBiquadFilter(), engineNoiseGain=context.createGain(), windFilter=context.createBiquadFilter(), windGain=context.createGain(), rainFilter=context.createBiquadFilter(), rainGain=context.createGain();
        engineNoiseFilter.type='lowpass'; engineNoiseFilter.frequency.value=190; engineNoiseFilter.Q.value=.7; engineNoiseGain.gain.value=engineVolume*.012;
        windFilter.type='lowpass'; windFilter.frequency.value=480; windGain.gain.value=environmentVolume*(.001+ride.current.speed/210*.018);
        rainFilter.type='lowpass'; rainFilter.frequency.value=1250; rainGain.gain.value=environmentVolume*(weather==='Thunderstorm'?.02:weather==='Heavy Rain'?.016:weather==='Light Rain'?.01:0);
        noise.connect(engineNoiseFilter).connect(engineNoiseGain).connect(master);
        noise.connect(windFilter).connect(windGain).connect(master); noise.connect(rainFilter).connect(rainGain).connect(master); noise.start();
        engineOscillatorRef.current=oscillator; engineGainRef.current=engineGain; engineNoiseGainRef.current=engineNoiseGain; windGainRef.current=windGain; windFilterRef.current=windFilter; rainGainRef.current=rainGain;
      }
      const context = audioContextRef.current;
      void context.resume().then(() => setAudioStatus(context.state === 'running' ? 'ready' : 'locked')).catch(() => setAudioStatus('locked'));
    } catch (error) {
      console.error('NIGHT RIDE audio initialization failed', error);
      setAudioStatus('unavailable');
    }
  };
  useEffect(() => {
    let initialized = false;
    const unlockAudio = () => {
      startAudio();
      if (!initialized) {
        initialized = true;
        if (screenRef.current === 'menu') setMusicOn(true);
      }
    };
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    return () => { window.removeEventListener('pointerdown', unlockAudio, true); window.removeEventListener('keydown', unlockAudio, true); };
  }, []);
  const toggleMusicPlayback = () => {
    startAudio();
    const context = audioContextRef.current;
    if (context && context.state !== 'running') void context.resume().then(() => setAudioStatus(context.state === 'running' ? 'ready' : 'locked')).catch(() => setAudioStatus('locked'));
    const shouldPlay = !musicOn;
    if (shouldPlay && !tracks.length) { setYoutubePanelOpen(true); setYoutubeState('loading'); }
    else if (!shouldPlay) youtubeCommand('pauseVideo');
    setMusicOn(shouldPlay);
    const player = audioRef.current;
    if (tracks.length && player) {
      if (shouldPlay) void player.play().catch(() => setMusicOn(false));
      else player.pause();
    }
  };
  useEffect(() => { lofiGenreRef.current(musicGenre); }, [musicGenre]);
  useEffect(() => {
    let raf = 0, last = performance.now(), uiElapsed = 0, autoLane = 2.5;
    const cruiseLanes = [2.5, 7.5];
    const tick = (now: number) => {
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const playing = screenRef.current === 'ride', keys = playing ? keysRef.current : {}, r = ride.current;
      const bike = motorcycleCatalog.find(model => model.id === bikeModelId) ?? motorcycleCatalog[0];
      const acc = keys.w || keys.arrowup, brake = keys.s || keys.arrowdown, left = keys.a || keys.arrowleft, right = keys.d || keys.arrowright;
      const auto = playing && r.autoRide && !acc && !brake && !left && !right;
      let laneClear = true, obstacleDistance = 1000;
      if (auto) {
        for (const car of trafficRef.current) {
          if (!car.opposing && car.z < -2 && car.z > -46 && Math.abs(car.x - autoLane) < 1.95) { laneClear = false; obstacleDistance = Math.min(obstacleDistance, -car.z); }
        }
        if (!laneClear) {
          let foundLane = false;
          for (const lane of cruiseLanes) {
            let clearLane = true;
            for (const car of trafficRef.current) if (!car.opposing && car.z < -2 && car.z > -42 && Math.abs(car.x - lane) < 1.95) { clearLane = false; break; }
            if (clearLane) { autoLane = lane; foundLane = true; break; }
          }
          if (foundLane) { laneClear = true; obstacleDistance = 1000; }
        }
      } else autoLane = r.steer < 5 ? 2.5 : 7.5;
      const cruiseMax = Math.min(150, bike.topSpeed), cruiseTarget = Math.min(138, cruiseMax - 5);
      let autoAccel = auto ? THREE.MathUtils.clamp((cruiseTarget - r.speed) * .9, -12, bike.acceleration * .72) : 0;
      if (auto && !laneClear && obstacleDistance < 18) autoAccel = -bike.braking * THREE.MathUtils.clamp((18 - obstacleDistance) / 18, .18, .62);
      const accel = acc && playing ? bike.acceleration : auto ? autoAccel : 0;
      const decel = brake && playing ? bike.braking : acc && playing ? 0 : auto ? 1.3 : 13;
      r.speed = Math.max(0, Math.min(auto ? cruiseMax : bike.topSpeed, r.speed + (accel - decel) * dt));
      const manualSteer = (left ? -1 : 0) + (right ? 1 : 0);
      const targetLateral = auto ? THREE.MathUtils.clamp((autoLane - r.steer) * .72, -2.4, 2.4) : manualSteer * (2.4 + r.speed * .018) * bike.steering;
      r.lateralVelocity = THREE.MathUtils.damp(r.lateralVelocity, targetLateral, auto ? 1.6 : 4.6, dt);
      r.steer = THREE.MathUtils.clamp(r.steer + r.lateralVelocity * dt, -8.35, 8.35);
      if (Math.abs(r.steer) >= 8.34) r.lateralVelocity = 0;
      r.distance += r.speed * dt; r.throttle = !!acc || auto; r.brake = !!brake || (auto && !laneClear && obstacleDistance < 18);
      uiElapsed += dt;
      if (uiElapsed > .1) {
        const shownSpeed = Math.round(r.speed);
        const shownLoad = Math.round(Math.min(100, shownSpeed * .44 + (keys.w ? 16 : 0)));
        setDisplaySpeed(shownSpeed);
        setDisplayLoad(shownLoad);
        if (speedMeter.current) speedMeter.current.style.width = `${Math.min(100, shownSpeed / 2.1)}%`;
        const context = audioContextRef.current;
        if (context) {
          const now = context.currentTime;
          if (engineOscillatorRef.current) engineOscillatorRef.current.frequency.setTargetAtTime(48 + r.speed * 1.05 + (r.throttle ? 14 : 0), now, .1);
          if (engineGainRef.current) engineGainRef.current.gain.setTargetAtTime(engineVolume * (.034 + r.speed / 220 * .035 + (r.throttle ? .009 : 0)), now, .28);
          if (engineNoiseGainRef.current) engineNoiseGainRef.current.gain.setTargetAtTime(engineVolume * (.012 + r.speed / 220 * .014), now, .4);
          if (windGainRef.current) windGainRef.current.gain.setTargetAtTime(environmentVolume * (.001 + r.speed / 210 * .018), now, .5);
          if (windFilterRef.current) windFilterRef.current.frequency.setTargetAtTime(480 + r.speed * 3, now, .7);
          const rainFactor = weather === 'Thunderstorm' ? .02 : weather === 'Heavy Rain' ? .016 : weather === 'Light Rain' ? .01 : weather === 'Snow' ? .006 : 0;
          if (rainGainRef.current) rainGainRef.current.gain.setTargetAtTime(environmentVolume * rainFactor, now, .5);
        }
        uiElapsed = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [bikeModelId, engineVolume, environmentVolume, weather]);
  useEffect(() => { if (screen !== 'ride') keysRef.current = {}; }, [screen]);
  const openSettings=()=>{setSettingsReturn(screen==='ride'?'ride':'menu');setScreen('settings')};
  const begin=()=>{startAudio();setMusicOn(true);if(!tracks.length){setYoutubePanelOpen(true);setYoutubeState('loading')}setScreen('ride')};
  const changeGenre=(genre: MusicGenre)=>{setMusicGenre(genre);if(!tracks.length){startAudio();setMusicOn(true);setYoutubePanelOpen(true);setYoutubeState('loading')}};
  const stepTrack=(direction:number)=>{if(tracks.length){setTrackIndex(i=>(i+direction+tracks.length)%tracks.length);setMusicOn(true)}};
  return <main className="app" onPointerDownCapture={()=>{if(screen==='menu'){startAudio();setMusicOn(true)}}}>
    <Canvas dpr={quality==='Low'?[.6,.85]:quality==='Medium'?[1,1.2]:[1,1.5]} gl={{ antialias: quality === 'High', powerPreference:'high-performance' }}>
      <World ride={ride} cameraMode={screen === 'ride' || screen === 'pause' ? cameraMode : 'chase'} color={color} bikeType={bikeType} bikeModelId={bikeModelId} environment={environment} weather={weather} timeOfDay={timeOfDay} quality={quality} fpsReadout={fpsReadout} />
      <Traffic ride={ride} density={trafficDensity} audioContext={audioContextRef} masterGain={masterGainRef} environmentVolume={environmentVolume} trafficSnapshot={trafficRef} quality={quality} />
    </Canvas>
    <div className="vignette" />
    {fpsDebug && <div ref={fpsReadout} style={{ position: 'absolute', zIndex: 20, left: 12, bottom: 12, padding: '5px 8px', color: '#c9e5ff', background: '#08111acc', border: '1px solid #ffffff30', font: '11px monospace', pointerEvents: 'none' }}>MEASURING FPS</div>}
    {hud && autoNotice && <div className="autoNotice" role="status">{autoNotice}</div>}
    {debugKeys && hud && <div style={{ position: 'absolute', zIndex: 4, top: 14, right: 18, padding: '7px 10px', background: '#09111dcc', border: '1px solid #ffffff30', color: '#cfdbeb', font: '10px monospace' }}>KEYS {Object.keys(keysRef.current).filter(k => keysRef.current[k]).join(' + ') || '—'}</div>}
    {screen==='menu' && <section className="menu overlay"><div className="eyebrow">A NIGHT RIDE EXPERIENCE</div><h1>NIGHT<span>RIDE</span></h1><p className="tagline">Find your quiet in the distance.</p><button className="primary" onClick={begin}>Start riding <span>GO</span></button><div className="menuLinks"><button onClick={openSettings}>Garage & ride setup</button><button onClick={openSettings}>Music & settings</button></div><div className="menuFoot">PROCEDURAL WORLDS · YOUR OWN SOUNDTRACK</div></section>}
    {(screen==='ride'||screen==='pause') && hud && <>
      <aside className="speed"><div className="speedNum"><span ref={speedReadout}>{displaySpeed}</span><small> KM/H</small></div><div className="meter"><i ref={speedMeter} style={{width:'0%'}} /></div><div className="rpm"><span>ENGINE LOAD</span><b ref={engineLoadReadout}>{displayLoad}%</b></div></aside>
      <nav className="minimalControls" aria-label="Ride controls">
        <span className="brand">NIGHT<span>RIDE</span></span>
        <button onClick={()=>setCameraMode(v=>v==='chase'?'cockpit':'chase')}>CAMERA <b>{cameraMode==='chase'?'3RD':'1ST'}</b></button>
        <button onClick={openSettings}>WORLD <b>{environment.toUpperCase()}</b></button>
        <button className={autoRide?'active':''} aria-pressed={autoRide} onClick={toggleAutoRide}>AUTO-RIDE <b>{autoRide?'ON · P':'OFF · P'}</b></button>
        <div className="miniPlayer">
          <button className="musicToggleButton" aria-label={musicOn?'Pause music':'Play music'} title={musicOn?'Pause music':'Play music'} onClick={toggleMusicPlayback}>{musicOn?'PAUSE':'PLAY'}</button>
          <button className="musicMuteButton" aria-label={musicMuted?'Unmute music':'Mute music'} onClick={()=>setMusicMuted(v=>!v)}>{musicMuted?'UNMUTE':'MUTE'}</button>
          <div className="miniTrack">
            <span className="trackTitle" title={tracks.length ? tracks[trackIndex]?.name : youtubeTracks[musicGenre].title}>{tracks.length ? tracks[trackIndex]?.name : youtubeTracks[musicGenre].title}</span>
            <small>{tracks.length ? 'LOCAL PLAYLIST' : 'YOUTUBE · '+musicGenre.toUpperCase()}</small>
            <small className={'audioStatus '+audioStatus} role="status">{audioStatus==='ready'?'AUDIO ACTIVE':audioStatus==='unavailable'?'AUDIO UNAVAILABLE · CHECK BROWSER':'CLICK TO ENABLE AUDIO'}</small>
            {!tracks.length&&<small className={'youtubeStatus '+youtubeState} role="status">{audioStatus==='unavailable'?'AUDIO UNAVAILABLE':youtubeState==='ready'?(musicOn?'YOUTUBE PLAYING':'PAUSED'):youtubeState==='blocked'?(musicOn?'SYNTH FALLBACK ACTIVE':'PAUSED'):youtubeState==='error'?(musicOn?'SYNTH FALLBACK ACTIVE':'YOUTUBE UNAVAILABLE'):'LOADING YOUTUBE'}</small>}
            <div className={'spectrum '+(musicOn?'playing':'')} aria-label="Audio visualizer">{Array.from({length:12},(_,i)=><i key={i} style={{'--bar':(.35+(i*7%9)/10)+'s'} as React.CSSProperties}/>)}</div>
          </div>
          {!tracks.length&&<select className="genreSelector" aria-label="Music genre" value={musicGenre} onChange={e=>changeGenre(e.target.value as MusicGenre)}><option>Lo-Fi</option><option>Synthwave</option><option>Phonk</option></select>}
          <label className="musicVolume" aria-label="Music volume"><span>MUSIC</span><input type="range" min="0" max="1" step=".01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))}/></label>
          <button aria-label="Open music and settings" onClick={openSettings}>+</button>
        </div>
        <span className="hudHint">PRESS H TO HIDE HUD</span>
      </nav>
      {cameraMode==='cockpit' && <div className={'visor '+(weather.includes('Rain')||weather==='Thunderstorm'?'wet':'')} aria-hidden="true"><i/><b/><em/></div>}
    </>}
    {screen==='pause' && hud && <section className="modal overlay"><div className="eyebrow">RIDE PAUSED</div><h2>Take your time.</h2><button className="primary" onClick={()=>setScreen('ride')}>Continue ride</button><button className="ghost" onClick={()=>setScreen('menu')}>Main menu</button></section>}
    {screen==='settings' && <section className="settings overlay"><button className="close" onClick={()=>setScreen(settingsReturn)}>BACK</button><div className="eyebrow">PERSONALIZE YOUR RIDE</div><h2>Ride setup</h2><label>Environment<select value={environment} onChange={e=>setEnvironment(e.target.value)}>{['Neon City','Mountain Pass','Forest Highway','Coastal Road'].map(x=><option key={x}>{x}</option>)}</select></label><label>Weather<select value={weather} onChange={e=>setWeather(e.target.value)}>{['Clear night','Light Rain','Heavy Rain','Fog','Thunderstorm'].map(x=><option key={x}>{x}</option>)}</select></label><label>Time<select value={timeOfDay} onChange={e=>setTimeOfDay(e.target.value)}>{['Deep night','Blue hour','Sunset','Sunrise'].map(x=><option key={x}>{x}</option>)}</select></label><label>Graphics<select value={quality} onChange={e=>setQuality(e.target.value)}>{['Low','Medium','High'].map(x=><option key={x}>{x}</option>)}</select></label><label>Traffic<select value={trafficDensity} onChange={e=>setTrafficDensity(e.target.value as typeof trafficDensity)}>{['Off','Low','Medium','High'].map(x=><option key={x}>{x}</option>)}</select></label><label>Camera<select value={cameraMode} onChange={e=>setCameraMode(e.target.value as 'chase'|'cockpit')}><option value="chase">Third person</option><option value="cockpit">First person</option></select></label><label>Motorcycle<select value={bikeModelId} onChange={e=>{const model=motorcycleCatalog.find(x=>x.id===e.target.value);if(model){setBikeModelId(model.id);setBikeType(model.category);setColor(model.color)}}}>{(["Sport","Naked","Touring","Retro"] as BikeType[]).map(category=><optgroup key={category} label={category}>{motorcycleCatalog.filter(model=>model.category===category).map(model=><option key={model.id} value={model.id}>{model.name}</option>)}</optgroup>)}</select></label><div className="bikeInfo"><strong>{selectedBike.name} · {selectedBike.category}</strong><small>Top {selectedBike.topSpeed} km/h · Accel {selectedBike.acceleration} · Handling {selectedBike.steering.toFixed(2)}</small><small>{selectedBike.description}</small></div><label>Bike paint<input type="color" value={color} onChange={e=>setColor(e.target.value)} /></label><div className="audioBox"><span>{youtubeTracks[musicGenre].title+' · YOUTUBE'}</span><label>Generated genre<select value={musicGenre} onChange={e=>setMusicGenre(e.target.value as MusicGenre)}>{(["Lo-Fi","Synthwave","Phonk"] as MusicGenre[]).map(genre=><option key={genre}>{genre}</option>)}</select></label><input type="file" accept="audio/*" multiple onChange={e=>{const files=Array.from(e.target.files ?? []); if(files.length){setTracks(v=>[...v,...files]);setTrackIndex(tracks.length);setMusicOn(true);}}}/>{tracks.map((track,i)=><div className="trackRow" key={`${track.name}-${i}`}><button className="trackSelect" onClick={()=>{setTrackIndex(i);setMusicOn(true)}}>{i===trackIndex?"Now playing: ":""}{track.name}</button><button className="removeTrack" onClick={()=>{setTracks(v=>v.filter((_,j)=>j!==i));if(i===trackIndex){setMusicOn(false);setTrackIndex(0)}else if(i<trackIndex)setTrackIndex(j=>j-1)}}>Remove</button></div>)}<div className="trackNav"><button onClick={()=>stepTrack(-1)} disabled={!tracks.length}>Previous</button><button onClick={toggleMusicPlayback}>{musicOn?"Pause":"Play"}</button><button onClick={()=>stepTrack(1)} disabled={!tracks.length}>Next</button></div><label className="seek">Seek<input type="range" min="0" max={trackDuration||1} step=".25" value={Math.min(trackTime,trackDuration||1)} disabled={!tracks.length||!trackDuration} onChange={e=>{const t=Number(e.target.value);setTrackTime(t);if(audioRef.current)audioRef.current.currentTime=t}}/><small>{Math.floor(trackTime/60)}:{String(Math.floor(trackTime%60)).padStart(2,"0")} / {Math.floor(trackDuration/60)}:{String(Math.floor(trackDuration%60)).padStart(2,"0")}</small></label><small>{musicGenre==='Lo-Fi'&&!tracks.length?'The YouTube audio source runs in the background; if the browser blocks it, the built-in Lo-Fi synthesizer is used.':'Imported audio stays on this device until you close the page.'}</small><label className="vol">Master volume<input type="range" min="0" max="1" step=".01" value={masterVolume} onChange={e=>setMasterVolume(Number(e.target.value))}/></label><label className="vol">Music volume<input type="range" min="0" max="1" step=".01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))}/></label><label className="vol">Engine volume<input type="range" min="0" max="1" step=".01" value={engineVolume} onChange={e=>setEngineVolume(Number(e.target.value))}/></label><label className="vol">Environment volume<input type="range" min="0" max="1" step=".01" value={environmentVolume} onChange={e=>setEnvironmentVolume(Number(e.target.value))}/></label></div><div className="controlsNote">W/^ accelerate · S/v brake · A/D steer · C camera · H HUD · Esc pause</div><button className="primary" onClick={()=>setScreen(settingsReturn)}>Done</button></section>}
    <div className="youtubeAudioHost" aria-hidden="true"><iframe ref={youtubeFrameRef} title="Background music audio" width="200" height="200" tabIndex={-1} src={`https://www.youtube.com/embed/${youtubeTracks[musicGenre].id}?enablejsapi=1&controls=0&playsinline=1&loop=1&playlist=${youtubeTracks[musicGenre].id}&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" onLoad={()=>setYoutubeLoaded(true)} /></div>
    <audio ref={audioRef} onLoadedMetadata={e=>{setTrackDuration(e.currentTarget.duration||0);setTrackTime(0)}} onTimeUpdate={e=>setTrackTime(e.currentTarget.currentTime)} onEnded={()=>stepTrack(1)} />
    {hud && <div className="caption">W / UP ACCELERATE · S / DOWN BRAKE · A/D STEER · C CAMERA · P AUTO-RIDE · H HUD</div>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);

