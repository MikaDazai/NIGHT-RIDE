import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const motorbikeModelUrl = 'https://static.poly.pizza/79a4ebfd-e89c-4bdb-a1ac-fdf6c9adf839.glb';
export const trafficModelUrls = {
  coupe: 'https://static.poly.pizza/34db1344-31cc-49ac-bc46-c055f68e39ca.glb',
  suv: 'https://static.poly.pizza/e5fbf2ee-5c9e-47d5-8ab6-80cacd463baa.glb',
  truck: 'https://static.poly.pizza/4e925a01-dbb8-4aab-848b-221306b835ea.glb',
} as const;

const modelLoads = new Map<string, Promise<THREE.Group | null>>();

export function useExternalGltf(url: string): THREE.Group | null {
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let active = true;
    let pending = modelLoads.get(url);
    if (!pending) {
      const loader = new GLTFLoader();
      loader.setCrossOrigin('anonymous');
      pending = loader.loadAsync(url).then(({ scene }) => scene).catch(error => {
        console.warn(`Unable to load external vehicle model ${url}; using procedural fallback.`, error);
        return null;
      });
      modelLoads.set(url, pending);
    }
    pending.then(scene => { if (active) setModel(scene); });
    return () => { active = false; };
  }, [url]);

  return model;
}

function cloneAndCustomizeMaterials(model: THREE.Group, color: string, motorcycle: boolean) {
  const materialClones = new Map<THREE.Material, THREE.Material>();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const clone = (material: THREE.Material) => {
      let copy = materialClones.get(material);
      if (!copy) {
        copy = material.clone();
        materialClones.set(material, copy);
        const name = material.name.toLowerCase();
        const paint = motorcycle ? name === 'blue' : /paint|body|white|atlas/.test(name);
        if (copy instanceof THREE.MeshStandardMaterial) {
          if (paint) {
            copy.color.set(color);
            copy.metalness = Math.max(copy.metalness, .5);
            copy.roughness = Math.min(copy.roughness, .28);
            if (copy instanceof THREE.MeshPhysicalMaterial) {
              copy.clearcoat = .72;
              copy.clearcoatRoughness = .18;
            }
          }
          if (name.includes('headlight')) {
            copy.emissive.set('#b9dcff');
            copy.emissiveIntensity = 2.8;
          } else if (name.includes('taillight') || name.includes('brakelight')) {
            copy.emissive.set('#ff1838');
            copy.emissiveIntensity = 2.5;
          }
        }
      }
      return copy;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(clone)
      : clone(object.material);
  });
}

function makeWheelPivot(mesh: THREE.Mesh, wheels: THREE.Object3D[]) {
  const geometry = mesh.geometry;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds || !mesh.parent) return;

  const center = bounds.getCenter(new THREE.Vector3());
  const originalPosition = mesh.position.clone();
  const originalRotation = mesh.quaternion.clone();
  const originalScale = mesh.scale.clone();
  const offset = center.clone().multiply(originalScale).applyQuaternion(originalRotation);
  const pivot = new THREE.Group();
  pivot.name = `${mesh.name || 'wheel'}-rotation-pivot`;
  pivot.position.copy(originalPosition).add(offset);
  pivot.quaternion.copy(originalRotation);
  pivot.scale.copy(originalScale);

  const centeredGeometry = geometry.clone();
  centeredGeometry.translate(-center.x, -center.y, -center.z);
  centeredGeometry.userData.nightRideOwned = true;
  mesh.geometry = centeredGeometry;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.scale.set(1, 1, 1);
  const parent = mesh.parent;
  parent.add(pivot);
  parent.remove(mesh);
  pivot.add(mesh);
  wheels.push(pivot);
}

export function createVehicleInstance(
  source: THREE.Group,
  options: { length: number; color: string; motorcycle?: boolean },
): { root: THREE.Group; wheels: THREE.Object3D[] } {
  const model = source.clone(true);
  cloneAndCustomizeMaterials(model, options.color, !!options.motorcycle);

  const wheels: THREE.Object3D[] = [];
  const wheelMeshes: THREE.Mesh[] = [];
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const namedWheel = /wheel|tire/i.test(object.name);
    let roundBikeWheel = false;
    if (options.motorcycle) {
      object.geometry.computeBoundingBox();
      const size = object.geometry.boundingBox?.getSize(new THREE.Vector3());
      roundBikeWheel = !!size
        && size.x < size.y * .45
        && Math.abs(size.y - size.z) < Math.max(size.y, size.z) * .2;
    }
    if (namedWheel || roundBikeWheel) wheelMeshes.push(object);
  });
  wheelMeshes.forEach(mesh => makeWheelPivot(mesh, wheels));

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const root = new THREE.Group();
  root.name = options.motorcycle ? 'external-motorcycle' : 'external-traffic-vehicle';
  root.add(model);
  model.position.set(-center.x, -bounds.min.y, -center.z);
  root.scale.setScalar(options.length / Math.max(size.z, .001));
  root.rotation.y = Math.PI;
  return { root, wheels };
}

export function disposeVehicleInstance(root: THREE.Group) {
  const materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.geometry.userData.nightRideOwned) object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
    }
  });
  materials.forEach(material => material.dispose());
}
