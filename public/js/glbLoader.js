// glbLoader.js - GLB 파일 로드 및 처리
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export class GLBLoader {
    constructor() {
        this.loader = new GLTFLoader();
    }
    
    loadFromFile(file, onSuccess, onError) {
        if (!file) {
            if (onError) onError(new Error('파일이 제공되지 않았습니다.'));
            return;
        }
        
        // 파일 확장자 검사
        const validExtensions = ['.glb', '.gltf'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            if (onError) onError(new Error('지원되지 않는 파일 형식입니다. GLB 또는 GLTF 파일만 지원합니다.'));
            return;
        }
        
        // 파일을 ArrayBuffer로 읽기
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            this.parseGLB(arrayBuffer, onSuccess, onError);
        };
        
        reader.onerror = (e) => {
            if (onError) onError(new Error('파일을 읽는 중 오류가 발생했습니다: ' + e.target.error));
        };
    }
    
    parseGLB(buffer, onSuccess, onError) {
        this.loader.parse(buffer, '', (gltf) => {
            const model = gltf.scene;
            const bones = this.findBones(model);
            const animations = gltf.animations || [];
            
            // 모델 처리 결과 반환
            if (onSuccess) {
                onSuccess({
                    model,
                    bones,
                    animations
                });
            }
        }, undefined, (error) => {
            if (onError) onError(error);
        });
    }
    
    findBones(model) {
        const bones = [];
        
        // 재귀적으로 모델 내의 모든 본 찾기
        const traverseForBones = (object) => {
            if (object.isBone) {
                bones.push(object);
            }
            
            if (object.children && object.children.length > 0) {
                object.children.forEach(child => {
                    traverseForBones(child);
                });
            }
        };
        
        traverseForBones(model);
        return bones;
    }
    
    makeBonesClickable(bones, onClick) {
        bones.forEach(bone => {
            // 본에 클릭 가능 플래그 추가
            bone.userData.isClickable = true;
            
            // 본에 속한 모든 메시에 클릭 이벤트 설정
            if (bone.children) {
                bone.children.forEach(child => {
                    if (child.isMesh) {
                        child.userData.isClickable = true;
                        child.userData.boneUuid = bone.uuid;
                        
                        // 클릭 가능하다는 표시로 메시 속성 설정
                        if (child.material) {
                            child.material.transparent = true;
                            child.material.opacity = 0.8;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        });
    }
    
    setupBoneRaycaster(renderer, camera, scene, onClick) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // 클릭 이벤트 리스너
        renderer.domElement.addEventListener('click', (event) => {
            // 마우스 위치를 정규화된 장치 좌표로 변환 (-1 ~ +1)
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // 레이캐스트 업데이트
            raycaster.setFromCamera(mouse, camera);
            
            // 클릭 가능한 객체와의 교차점 확인
            const intersects = raycaster.intersectObjects(scene.children, true);
            
            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                
                // 클릭 가능한 본 메시인지 확인
                if (object.userData.isClickable) {
                    const boneUuid = object.userData.boneUuid || object.uuid;
                    
                    if (onClick) {
                        onClick(boneUuid);
                    }
                    
                    break;
                }
            }
        });
    }
}