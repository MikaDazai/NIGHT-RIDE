import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVehicleInstance, disposeVehicleInstance, motorbikeModelUrl, useExternalGltf } from './ExternalVehicleModels';

export type BikeRideState = {
  speed: number;
  steer: number;
  steeringAngle: number;
  lateralVelocity: number;
  distance: number;
  throttle: boolean;
  brake: boolean;
  autoRide: boolean;
  tunnelActive: boolean;
  underglowColor: string;
};

type BikeModelProps = {
  ride: React.MutableRefObject<BikeRideState>;
  cameraMode: 'chase' | 'cockpit' | 'cinematic';
  color: string;
  bikeType: 'Sport' | 'Naked' | 'Touring' | 'Retro';
  bikeModelId: string;
  quality: string;
};

const chromeMaterial = new THREE.MeshStandardMaterial({ color: '#b7c4ce', metalness: .92, roughness: .2 });
const rubberMaterial = new THREE.MeshStandardMaterial({ color: '#10151c', roughness: .84 });
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#394550', metalness: .76, roughness: .32 });
const riderMaterial = new THREE.MeshStandardMaterial({ color: '#202a36', metalness: .18, roughness: .76 });
const visorMaterial = new THREE.MeshPhysicalMaterial({ color: '#14283a', metalness: .72, roughness: .13, clearcoat: 1, clearcoatRoughness: .08 });
const cyanGlowMaterial = new THREE.MeshBasicMaterial({ color: '#45e4ff', toneMapped: false });
const pinkGlowMaterial = new THREE.MeshBasicMaterial({ color: '#ff58ad', toneMapped: false });
const visorGlowMaterial = new THREE.MeshBasicMaterial({ color: '#64eaff', toneMapped: false });

function extrudedPanel(points: Array<[number, number]>, depth: number, bevel = .08) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(.02, depth - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -(depth - bevel * 2) / 2);
  return geometry;
}

function tubeBetween(start: THREE.Vector3, end: THREE.Vector3, radius: number) {
  const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, .5), end]);
  return new THREE.TubeGeometry(curve, 10, radius, 7, false);
}

function makeCarbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#171d25';
    context.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) {
      for (let x = 0; x < 128; x += 8) {
        const offset = (y / 8) % 2 ? 4 : 0;
        context.fillStyle = '#242c35';
        context.fillRect(x + offset, y, 4, 4);
        context.fillStyle = '#0e131a';
        context.fillRect(x + offset + 4, y + 4, 4, 4);
        context.fillStyle = '#303943';
        context.fillRect(x + offset, y + 4, 4, 1);
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 3);
  return texture;
}

function Wheel({ front, z, wheelRef }: { front: boolean; z: number; wheelRef: React.RefObject<THREE.Group> }) {
  const tireGeometry = useMemo(() => {
    const radius = front ? .335 : .36;
    const width = front ? .19 : .25;
    const points = [
      new THREE.Vector2(radius * .78, -width / 2),
      new THREE.Vector2(radius * .96, -width * .42),
      new THREE.Vector2(radius, -width * .25),
      new THREE.Vector2(radius, width * .25),
      new THREE.Vector2(radius * .96, width * .42),
      new THREE.Vector2(radius * .78, width / 2),
      new THREE.Vector2(.055, width / 2),
      new THREE.Vector2(.055, -width / 2),
    ];
    const geometry = new THREE.LatheGeometry(points, 32);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }, [front]);
  const rimGeometry = useMemo(() => {
    const points = [
      new THREE.Vector2(.09, -.07), new THREE.Vector2(.12, -.065),
      new THREE.Vector2(.245, -.045), new THREE.Vector2(.26, -.022),
      new THREE.Vector2(.26, .022), new THREE.Vector2(.245, .045),
      new THREE.Vector2(.12, .065), new THREE.Vector2(.09, .07),
    ];
    const geometry = new THREE.LatheGeometry(points, 28);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }, []);
  const rotorGeometry = useMemo(() => {
    const geometry = new THREE.TorusGeometry(front ? .235 : .22, .012, 5, 28);
    geometry.rotateY(Math.PI / 2);
    return geometry;
  }, [front]);
  const spokeGeometry = useMemo(() => {
    const pieces: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 10; index++) {
      const angle = index * Math.PI / 10;
      const inner = new THREE.Vector3(0, Math.cos(angle) * .095, Math.sin(angle) * .095);
      const outer = new THREE.Vector3(0, Math.cos(angle + .18) * .245, Math.sin(angle + .18) * .245);
      for (const x of [-.035, .035]) {
        const spoke = tubeBetween(inner, outer, .009);
        spoke.translate(x, 0, 0);
        pieces.push(spoke);
      }
    }
    const merged = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (!merged) throw new Error('Unable to build motorcycle wheel spokes');
    return merged;
  }, []);
  const treadGeometry = useMemo(() => {
    const pieces = Array.from({ length: 32 }, (_, index) => {
      const angle = index * Math.PI / 16;
      const radius = front ? .335 : .36;
      const tread = new THREE.BoxGeometry(.012, .038, .24);
      tread.rotateY(-angle);
      tread.translate(Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
      return tread;
    });
    const merged = mergeGeometries(pieces);
    pieces.forEach(piece => piece.dispose());
    if (!merged) throw new Error('Unable to build motorcycle tire treads');
    return merged;
  }, [front]);
  const axleGeometry = useMemo(() => new THREE.SphereGeometry(.075, 12, 8), []);
  return <group ref={wheelRef} position={[0, .39, z]}>
    <mesh geometry={tireGeometry} material={rubberMaterial} />
    <mesh geometry={treadGeometry} material={rubberMaterial} />
    <mesh geometry={rimGeometry} material={chromeMaterial} />
    <mesh geometry={spokeGeometry} material={chromeMaterial} />
    {[-1, 1].map(side => <React.Fragment key={`rotor-${side}`}>
      <mesh geometry={rotorGeometry} position={[side * .11, 0, 0]} material={chromeMaterial} />
      <mesh position={[side * .11, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[front ? .215 : .2, 24]} />
        <meshStandardMaterial color="#48535e" metalness={.82} roughness={.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[side * .14, front ? .17 : -.16, front ? -.15 : .15]}>
        <boxGeometry args={[.09, .15, .12]} />
        <meshStandardMaterial color="#b0444f" metalness={.48} roughness={.3} />
      </mesh>
    </React.Fragment>)}
    <mesh geometry={axleGeometry} material={chromeMaterial} />
  </group>;
}

export function BikeModel({ ride, cameraMode, color, bikeType, bikeModelId, quality }: BikeModelProps) {
  const root = useRef<THREE.Group>(null);
  const steering = useRef<THREE.Group>(null);
  const frontWheel = useRef<THREE.Group>(null);
  const rearWheel = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const headlightTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, .1, -28);
    return target;
  }, []);
  const rpmSegments = useRef<THREE.Mesh[]>([]);
  const dashCanvas = useRef<HTMLCanvasElement | null>(null);
  const dashTexture = useRef<THREE.CanvasTexture | null>(null);
  const dashElapsed = useRef(0);
  const idleClock = useRef(0);
  const motorcycleSource = useExternalGltf(motorbikeModelUrl);
  const externalMotorcycle = useMemo(() => motorcycleSource
    ? createVehicleInstance(motorcycleSource, { length: 1.8, color, motorcycle: true })
    : null, [motorcycleSource, color]);
  useEffect(() => () => {
    if (externalMotorcycle) disposeVehicleInstance(externalMotorcycle.root);
  }, [externalMotorcycle]);
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({
    color, metalness: .72, roughness: .2, clearcoat: 1, clearcoatRoughness: .12,
    emissive: new THREE.Color(color).multiplyScalar(.045),
  }), [color]);
  const carbonTexture = useMemo(makeCarbonTexture, []);
  const carbon = useMemo(() => new THREE.MeshStandardMaterial({ map: carbonTexture, metalness: .42, roughness: .45 }), [carbonTexture]);
  const modelVariant = Math.max(0, bikeModelId.length % 3);
  const frontZ = -(.9 + modelVariant * .08);
  const rearZ = .66 + modelVariant * .07;
  const helmetGeometry = useMemo(() => new THREE.LatheGeometry([
    new THREE.Vector2(0, -.18),
    new THREE.Vector2(.11, -.18),
    new THREE.Vector2(.16, -.12),
    new THREE.Vector2(.18, -.02),
    new THREE.Vector2(.17, .1),
    new THREE.Vector2(.12, .18),
    new THREE.Vector2(.055, .21),
    new THREE.Vector2(0, .21),
  ], 24), []);
  const tank = useMemo(() => extrudedPanel([
    [-.27, .65], [-.3, .79], [-.22, .94], [-.12, 1.02],
    [.12, 1.02], [.22, .94], [.3, .79], [.27, .65],
  ], .62, .065), []);
  const fairing = useMemo(() => extrudedPanel([
    [-.25, .66], [-.42, .78], [-.38, 1.02], [-.21, 1.2],
    [-.09, 1.24], [.09, 1.24], [.21, 1.2], [.38, 1.02],
    [.42, .78], [.25, .66],
  ], .72, .055), []);
  const tail = useMemo(() => extrudedPanel([
    [-.24, .69], [-.3, .79], [-.22, .9], [-.1, .95],
    [.1, .95], [.22, .9], [.3, .79], [.24, .69],
  ], .5, .045), []);
  const frameCurves = useMemo(() => [
    new THREE.CatmullRomCurve3([new THREE.Vector3(-.2, .62, .15), new THREE.Vector3(-.19, .72, -.05), new THREE.Vector3(-.12, .9, -.42), new THREE.Vector3(-.1, 1.05, -.68)]),
    new THREE.CatmullRomCurve3([new THREE.Vector3(.2, .62, .15), new THREE.Vector3(.19, .72, -.05), new THREE.Vector3(.12, .9, -.42), new THREE.Vector3(.1, 1.05, -.68)]),
    new THREE.CatmullRomCurve3([new THREE.Vector3(-.2, .62, .15), new THREE.Vector3(-.24, .53, .42), new THREE.Vector3(-.16, .43, .58), new THREE.Vector3(0, .4, rearZ)]),
    new THREE.CatmullRomCurve3([new THREE.Vector3(.2, .62, .15), new THREE.Vector3(.24, .53, .42), new THREE.Vector3(.16, .43, .58), new THREE.Vector3(0, .4, rearZ)]),
  ], [rearZ]);
  const exhaust = useMemo(() => [-1, 1].map(side => new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .22, .56, .28),
    new THREE.Vector3(side * .34, .52, .48),
    new THREE.Vector3(side * .37, .61, .82),
    new THREE.Vector3(side * .34, .7, 1.08),
  ])), []);
  const handlebar = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.52, .08, .01), new THREE.Vector3(-.38, .11, -.01),
    new THREE.Vector3(0, .08, -.02), new THREE.Vector3(.38, .11, -.01),
    new THREE.Vector3(.52, .08, .01),
  ]), []);
  const frameGeometries = useMemo(() => frameCurves.map(curve => new THREE.TubeGeometry(curve, 16, .027, 7, false)), [frameCurves]);
  const forkGeometries = useMemo(() => [-1, 1].map(side => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * .13, 1.02, -.74),
    new THREE.Vector3(side * .14, .78, -.82),
    new THREE.Vector3(side * .15, .55, frontZ + .06),
    new THREE.Vector3(side * .15, .39, frontZ),
  ]), 14, .027, 8, false)), [frontZ]);
  const exhaustGeometries = useMemo(() => exhaust.map(curve => new THREE.TubeGeometry(curve, 16, .055, 9, false)), [exhaust]);
  const exhaustInnerGeometries = useMemo(() => exhaust.map(curve => new THREE.TubeGeometry(curve, 16, .033, 8, false)), [exhaust]);
  const handlebarGeometry = useMemo(() => new THREE.TubeGeometry(handlebar, 18, .025, 7, false), [handlebar]);
  const rimStrip = useMemo(() => new THREE.TorusGeometry(.25, .025, 7, 20), []);
  const mirrorStemGeometries = useMemo(() => [-1, 1].map(side => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * .04, .17, -.08), new THREE.Vector3(side * .1, .27, -.12),
  ]), 8, .018, 6, false)), []);
  const leverGeometries = useMemo(() => [-1, 1].map(side => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * .08, -.025, -.03),
    new THREE.Vector3(side * .11, -.07, -.05),
  ]), 8, .009, 5, false)), []);
  const armGeometries = useMemo(() => [-1, 1].map(side => tubeBetween(
    new THREE.Vector3(side * .32, 1.15, -.12),
    new THREE.Vector3(side * .37, .99, -.59),
    .056,
  )), []);
  const legGeometries = useMemo(() => [-1, 1].map(side => tubeBetween(
    new THREE.Vector3(side * .16, 1.1, .13),
    new THREE.Vector3(side * .27, .72, .39),
    .09,
  )), []);
  const sidePanelGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-.08, -.2); shape.lineTo(.05, -.18); shape.lineTo(.2, .15); shape.lineTo(.12, .21); shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const windshieldGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-.25, 0); shape.quadraticCurveTo(-.2, .27, -.11, .38);
    shape.lineTo(.11, .38); shape.quadraticCurveTo(.2, .27, .25, 0); shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);
  const visorShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-.125, .02); shape.quadraticCurveTo(-.16, .1, -.1, .17);
    shape.quadraticCurveTo(0, .21, .1, .17); shape.quadraticCurveTo(.16, .1, .125, .02);
    shape.quadraticCurveTo(0, -.02, -.125, .02);
    return shape;
  }, []);
  useFrame((_, dt) => {
    const state = ride.current;
    idleClock.current += dt;
    if (root.current) {
      root.current.position.x = THREE.MathUtils.damp(root.current.position.x, state.steer, 8, dt);
      const lean = THREE.MathUtils.clamp(-state.lateralVelocity * .028, -.33, .33);
      root.current.rotation.z = THREE.MathUtils.damp(root.current.rotation.z, lean, 4.8, dt);
      root.current.position.y = .025 + Math.sin(state.distance * .22) * Math.min(.014, state.speed / 14000);
    }
    if (steering.current) steering.current.rotation.y = -state.steeringAngle * .34;
    const spin = state.speed * dt * .19;
    if (frontWheel.current) frontWheel.current.rotation.x -= spin;
    if (rearWheel.current) rearWheel.current.rotation.x -= spin;
    externalMotorcycle?.wheels.forEach(wheel => { wheel.rotation.x -= state.speed * dt * .7; });
    if (torso.current) torso.current.rotation.x = -.025 + Math.sin(idleClock.current * 1.3) * .008 + Math.sin(state.distance * .035) * .006;
    rpmSegments.current.forEach((segment, index) => {
      if (segment) {
        const active = index < Math.round(THREE.MathUtils.clamp(state.speed / 21 + (state.throttle ? 1 : 0), 0, 10));
        (segment.material as THREE.MeshBasicMaterial).color.set(active ? (index > 7 ? '#ff527d' : '#56e8d0') : '#1c3542');
      }
    });
    dashElapsed.current += dt;
    if (dashElapsed.current > .12 && dashCanvas.current && dashTexture.current) {
      dashElapsed.current = 0;
      const context = dashCanvas.current.getContext('2d');
      if (context) {
        context.clearRect(0, 0, 256, 96);
        context.fillStyle = '#07121c';
        context.fillRect(0, 0, 256, 96);
        context.fillStyle = '#75f4e1';
        context.font = '600 49px monospace';
        context.fillText(String(Math.round(state.speed)).padStart(3, '0'), 18, 60);
        context.font = '14px monospace';
        context.fillText('km/h', 178, 59);
        dashTexture.current.needsUpdate = true;
      }
    }
  });
  const underglow = ride.current.underglowColor;
  const upright = bikeType === 'Naked' || bikeType === 'Touring';
  const dashboardCanvas = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    return canvas;
  }, []);
  const dashboardTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(dashboardCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [dashboardCanvas]);
  dashCanvas.current = dashboardCanvas;
  dashTexture.current = dashboardTexture;
  return <group ref={root}>
    <primitive object={headlightTarget} />
    {quality !== 'Low' && <spotLight position={[0, 1.14, -.95]} target={headlightTarget} angle={.44} penumbra={.8} intensity={105} distance={50} color="#dcecff" />}
    {underglow !== 'off' && <>
      {quality !== 'Low' && <pointLight position={[0, .16, 0]} color={underglow} intensity={2.2} distance={4.5} />}
      <mesh position={[0, .09, -.02]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.74, 1.8]} /><meshBasicMaterial color={underglow} transparent opacity={.28} depthWrite={false} toneMapped={false} /></mesh>
    </>}
    <group visible={!externalMotorcycle}>
    <Wheel front z={frontZ} wheelRef={frontWheel} />
    <Wheel front={false} z={rearZ} wheelRef={rearWheel} />
    {frameGeometries.map((geometry, index) => <mesh key={`frame-${index}`} geometry={geometry} material={frameMaterial} />)}
    {forkGeometries.map((geometry, index) => <mesh key={`fork-${index}`} geometry={geometry} material={chromeMaterial} />)}
    {[-1, 1].map(side => <mesh key={`fork-boot-${side}`} position={[side * .14, .9, -.78]} rotation={[.22, 0, 0]}>
      <cylinderGeometry args={[.044, .044, .13, 10]} />
      <meshStandardMaterial color="#202832" roughness={.66} />
    </mesh>)}
    <mesh position={[0, .67, .2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.2, .23, .42, 18]} /><meshStandardMaterial color="#3f4b57" metalness={.8} roughness={.3} /></mesh>
    <mesh position={[0, .48, .43]} material={carbon}><boxGeometry args={[.36, .12, .46]} /></mesh>
    <mesh geometry={tank} position={[0, 0, -.13]} material={paint} castShadow />
    <mesh geometry={tail} position={[0, 0, .61]} material={paint} />
    <mesh geometry={fairing} position={[0, 0, -.76]} material={paint} />
    {[-1, 1].map(side => <React.Fragment key={`side-detail-${side}`}>
      <mesh position={[side * .31, .75, -.69]} rotation={[0, 0, side * -.16]} geometry={sidePanelGeometry}>
        <meshPhysicalMaterial color={color} metalness={.68} roughness={.21} clearcoat={1} emissive={color} emissiveIntensity={.08} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[side * .3, .75, -.72]} rotation={[0, 0, side * -.13]}>
        <boxGeometry args={[.025, .04, .42]} />
        <primitive object={side < 0 ? cyanGlowMaterial : pinkGlowMaterial} attach="material" />
      </mesh>
      <mesh>
        <primitive object={exhaustGeometries[side < 0 ? 0 : 1]} attach="geometry" />
        <meshStandardMaterial color="#6e7c89" metalness={.94} roughness={.24} />
      </mesh>
      <mesh>
        <primitive object={exhaustInnerGeometries[side < 0 ? 0 : 1]} attach="geometry" />
        <meshStandardMaterial color="#19232d" metalness={.82} roughness={.28} side={THREE.BackSide} />
      </mesh>
      <mesh position={[side * .55, .91, -.64]} rotation={[0, 0, side * -.24]} geometry={mirrorStemGeometries[side < 0 ? 0 : 1]} material={chromeMaterial} />
      <mesh position={[side * .66, 1.19, -.77]} rotation={[0, 0, side * -.2]} scale={[1.15, .62, .22]}>
        <sphereGeometry args={[.11, 14, 10]} />
        <primitive object={chromeMaterial} attach="material" />
      </mesh>
    </React.Fragment>)}
    <mesh position={[0, .95, -.83]} rotation={[Math.PI / 2, 0, 0]}>
      <primitive object={rimStrip} attach="geometry" />
      <primitive object={chromeMaterial} attach="material" />
    </mesh>
    <mesh position={[0, .95, -.82]}><circleGeometry args={[.23, 24]} /><meshBasicMaterial color="#d7f6ff" toneMapped={false} /></mesh>
    <mesh position={[0, .97, -.84]}><boxGeometry args={[.29, .045, .045]} /><meshBasicMaterial color="#f4fbff" toneMapped={false} /></mesh>
    <mesh position={[0, .71, .91]}><boxGeometry args={[.26, .07, .035]} /><meshBasicMaterial color="#ff355c" toneMapped={false} /></mesh>
    {(bikeType === 'Sport' || bikeType === 'Touring') && <mesh position={[0, 1.22, -.89]} rotation={[-.2, 0, 0]}>
      <primitive object={windshieldGeometry} attach="geometry" />
      <meshPhysicalMaterial color="#95dfff" transparent opacity={.23} roughness={.1} metalness={.25} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>}
    <group ref={steering} position={[0, upright ? .96 : .9, -.8]}>
      <mesh geometry={handlebarGeometry} material={chromeMaterial} />
      {[-1, 1].map(side => <React.Fragment key={`clipon-${side}`}>
        <mesh position={[side * .43, -.01, -.015]} rotation={[0, 0, side * -.24]}>
          <cylinderGeometry args={[.045, .045, .16, 12]} />
          <meshStandardMaterial color="#161c24" roughness={.76} />
        </mesh>
        <mesh position={[side * .42, .02, -.05]} rotation={[0, 0, side * -.5]} geometry={leverGeometries[side < 0 ? 0 : 1]} material={chromeMaterial} />
      </React.Fragment>)}
    </group>
    <mesh position={[0, .99, -.38]} rotation={[-.08, 0, 0]}>
      <planeGeometry args={[.34, .13]} />
      <meshBasicMaterial map={dashboardTexture} toneMapped={false} />
    </mesh>
    {Array.from({ length: 10 }, (_, index) => <mesh key={`rpm-${index}`} ref={node => { if (node) rpmSegments.current[index] = node; }} position={[(index - 4.5) * .037, 1.08, -.37]}>
      <boxGeometry args={[.025, .018, .012]} />
      <meshBasicMaterial color="#1c3542" toneMapped={false} />
    </mesh>)}
    {bikeType === 'Touring' && [-1, 1].map(side => <mesh key={`pannier-${side}`} position={[side * .57, .72, .52]} rotation={[0, 0, side * -.06]} scale={[.18, .22, .32]} material={paint}>
      <sphereGeometry args={[1, 12, 8]} />
    </mesh>)}
    {bikeType === 'Retro' && <mesh position={[0, .85, -.8]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.24, .028, 8, 24]} />
      <primitive object={chromeMaterial} attach="material" />
    </mesh>}
    <mesh position={[0, .91, .27]} rotation={[.14, 0, 0]} material={carbon}>
      <capsuleGeometry args={[.13, .32, 4, 10]} />
    </mesh>
    </group>
    {externalMotorcycle && <primitive object={externalMotorcycle.root} dispose={null} />}
    {externalMotorcycle && <>
      <mesh position={[0, .66, -.78]}><boxGeometry args={[.3, .06, .035]} /><meshBasicMaterial color="#dceeff" toneMapped={false} /></mesh>
      {quality !== 'Low' && <pointLight position={[0, .58, -.84]} color="#c7e4ff" intensity={5} distance={12} />}
      <mesh position={[0, .4, .78]}><boxGeometry args={[.24, .055, .035]} /><meshBasicMaterial color="#ff264b" toneMapped={false} /></mesh>
    </>}
    <group ref={torso} visible={cameraMode !== 'cockpit'}>
      <mesh position={[0, 1.2, .13]} rotation={[-.48, 0, 0]} material={riderMaterial}>
        <capsuleGeometry args={[.17, .37, 6, 12]} />
      </mesh>
      <mesh position={[0, 1.39, -.13]} rotation={[-.3, 0, 0]} material={riderMaterial}>
        <capsuleGeometry args={[.105, .16, 5, 10]} />
      </mesh>
      <mesh position={[0, 1.56, -.29]} scale={[1, .95, .9]} geometry={helmetGeometry} material={carbon}>
      </mesh>
      <mesh position={[0, 1.56, -.41]} rotation={[0, Math.PI, 0]} material={visorMaterial}>
        <shapeGeometry args={[visorShape]} />
      </mesh>
      <mesh position={[0, 1.66, -.36]} rotation={[-.2, 0, 0]}>
        <boxGeometry args={[.2, .018, .025]} />
        <primitive object={visorGlowMaterial} attach="material" />
      </mesh>
      {[-1, 1].map(side => <React.Fragment key={`rider-limb-${side}`}>
        <mesh position={[side * .22, 1.2, -.02]} rotation={[.24, 0, side * -.16]} material={riderMaterial}>
          <capsuleGeometry args={[.067, .28, 4, 8]} />
        </mesh>
        <mesh geometry={armGeometries[side < 0 ? 0 : 1]} material={riderMaterial} />
        <mesh position={[side * .39, .96, -.73]} rotation={[0, 0, side * .14]} material={rubberMaterial}>
          <capsuleGeometry args={[.052, .13, 4, 8]} />
        </mesh>
        <mesh geometry={legGeometries[side < 0 ? 0 : 1]} material={riderMaterial} />
        <mesh position={[side * .29, .53, .47]} rotation={[0, 0, side * -.12]} material={carbon}>
          <boxGeometry args={[.14, .09, .3]} />
        </mesh>
      </React.Fragment>)}
    </group>
    {bikeType === 'Naked' && !externalMotorcycle && <mesh position={[0, 1.05, -.76]} material={carbon}>
      <boxGeometry args={[.31, .11, .16]} />
    </mesh>}
  </group>;
}
