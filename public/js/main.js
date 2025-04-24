// main.js - 메인 스크립트
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SceneManager } from 'sceneManager';
import { BoneController } from 'boneController';
import { UIManager } from 'uiManager';

// 전역 변수
let sceneManager, boneController, uiManager;

// DOM이 로드되면 실행
window.addEventListener('DOMContentLoaded', function() {
    // 초기화 함수
    function init() {
        // 씬 매니저 초기화
        sceneManager = new SceneManager();
        
        // 본 컨트롤러 초기화
        boneController = new BoneController();
        
        // UI 매니저 초기화
        uiManager = new UIManager(onModelLoaded, highlightBone);
        
        // 이벤트 리스너 설정
        window.addEventListener('resize', onWindowResize);
        
        // 애니메이션 루프 시작
        animate();
    }
    
    // 윈도우 리사이징 처리
    function onWindowResize() {
        sceneManager.handleResize();
    }
    
    // 모델 로드 완료 시 호출되는 콜백
    function onModelLoaded(model, bones) {
        sceneManager.addModelToScene(model);
        boneController.setBones(bones);
        
        // 본 조작 UI 생성
        const boneGroups = boneController.getBoneGroups();
        uiManager.createBoneControls(boneGroups, boneController.getOriginalRotations());
        
        // 모델의 본에 클릭 이벤트 추가
        setupBoneClickEvents(bones);
    }
    
    // 3D 모델에서 본 클릭 이벤트 설정
    function setupBoneClickEvents(bones) {
        // 모든 본을 순회하며 클릭 가능하도록 설정
        bones.forEach(bone => {
            bone.userData.isClickable = true;
            
            // 본에 속한 모든 자식 메시에 클릭 가능하도록 설정
            if (bone.children) {
                bone.children.forEach(child => {
                    if (child.isMesh) {
                        child.userData.isClickable = true;
                        child.userData.boneUuid = bone.uuid;
                        
                        // 클릭 가능함을 시각적으로 표현 (약간 투명하게)
                        if (child.material) {
                            // 원본 재질 속성 유지
                            const originalOpacity = child.material.opacity;
                            const originalTransparent = child.material.transparent;
                            
                            // 클릭 가능함을 나타내는 속성 설정
                            child.material = child.material.clone(); // 재질 복제
                            child.material.transparent = true;
                            
                            // 원래 투명하지 않았다면 약간만 투명하게 설정
                            if (!originalTransparent) {
                                child.material.opacity = 0.9;
                            } else {
                                child.material.opacity = originalOpacity;
                            }
                            
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        });
        
        // 클릭 이벤트 리스너 설정
        const renderer = sceneManager.getRenderer();
        const camera = sceneManager.getCamera();
        const scene = sceneManager.getScene();
        
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        renderer.domElement.addEventListener('click', function(event) {
            // 마우스 위치를 정규화된 장치 좌표로 변환 (-1 ~ +1)
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // 레이캐스트 업데이트
            raycaster.setFromCamera(mouse, camera);
            
            // 클릭 가능한 객체와의 교차점 확인
            const intersects = raycaster.intersectObjects(scene.children, true);
            
            // 디버깅 메시지
            console.log(`클릭: 교차점 ${intersects.length}개 감지됨`);
            
            for (let i = 0; i < intersects.length; i++) {
                const object = intersects[i].object;
                console.log(`교차 객체: ${object.uuid}, 이름: ${object.name}, 클릭가능: ${object.userData.isClickable}`);
                
                // 클릭 가능한 본 메시인지 확인
                if (object.userData.isClickable) {
                    const boneUuid = object.userData.boneUuid || object.uuid;
                    console.log(`본 선택됨: ${boneUuid}`);
                    highlightBone(boneUuid);
                    break;
                }
            }
        });
    }
    
    // 본 강조 표시
    function highlightBone(boneUuid) {
        // UI에서 슬라이더 강조
        uiManager.highlightBoneSlider(boneUuid);
        
        // 3D 모델에서 본 강조
        const bones = boneController.getBones();
        sceneManager.highlightBone(bones, boneUuid);
    }
    
    // 애니메이션 루프
    function animate() {
        requestAnimationFrame(animate);
        sceneManager.update();
    }
    
    // 초기화 실행
    init();
});

// THREE 모듈을 window에 할당하여 접근 가능하게
window.THREE = THREE;