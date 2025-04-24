// boneController.js - 본 조작 및 분류 관리
import * as THREE from 'three';
export class BoneController {
    constructor() {
        this.bones = [];
        this.originalBoneRotations = new Map();
        this.boneGroups = {};
    }
    
    setBones(bones) {
        this.bones = bones;
        this.originalBoneRotations = new Map();
        
        // 원본 회전값 저장
        bones.forEach(bone => {
            this.originalBoneRotations.set(bone.uuid, {
                x: bone.rotation.x,
                y: bone.rotation.y,
                z: bone.rotation.z
            });
        });
        
        // 본 그룹화
        this.categorizeBones();
    }
    
    categorizeBones() {
        // 본을 그룹화하기 위한 객체 초기화
        this.boneGroups = {};
        
        // 본 이름에서 그룹 이름 추출하여 분류
        this.bones.forEach(bone => {
            let groupName = '기타';
            const boneName = bone.name;
            
            // 이름으로 본 그룹화 (예: Left_Arm, Right_Leg 등)
            if (boneName.includes('Left') || boneName.includes('left') || boneName.includes('L_')) {
                groupName = '왼쪽';
            } else if (boneName.includes('Right') || boneName.includes('right') || boneName.includes('R_')) {
                groupName = '오른쪽';
            } else if (boneName.includes('Head') || boneName.includes('head') || boneName.includes('Face') || boneName.includes('face')) {
                groupName = '머리';
            } else if (boneName.includes('Spine') || boneName.includes('spine') || boneName.includes('Torso') || boneName.includes('Body')) {
                groupName = '몸통';
            } else if (boneName.includes('Root') || boneName.includes('root') || boneName.includes('Hips') || boneName.includes('hips')) {
                groupName = '루트/엉덩이';
            } else if (boneName.includes('Hand') || boneName.includes('hand') || boneName.includes('Finger') || boneName.includes('finger')) {
                if (boneName.includes('Left') || boneName.includes('left') || boneName.includes('L_')) {
                    groupName = '왼쪽 손/손가락';
                } else if (boneName.includes('Right') || boneName.includes('right') || boneName.includes('R_')) {
                    groupName = '오른쪽 손/손가락';
                } else {
                    groupName = '손/손가락';
                }
            } else if (boneName.includes('Foot') || boneName.includes('foot') || boneName.includes('Toe') || boneName.includes('toe')) {
                if (boneName.includes('Left') || boneName.includes('left') || boneName.includes('L_')) {
                    groupName = '왼쪽 발/발가락';
                } else if (boneName.includes('Right') || boneName.includes('right') || boneName.includes('R_')) {
                    groupName = '오른쪽 발/발가락';
                } else {
                    groupName = '발/발가락';
                }
            } else if (boneName.includes('Arm') || boneName.includes('arm')) {
                if (boneName.includes('Left') || boneName.includes('left') || boneName.includes('L_')) {
                    groupName = '왼쪽 팔';
                } else if (boneName.includes('Right') || boneName.includes('right') || boneName.includes('R_')) {
                    groupName = '오른쪽 팔';
                } else {
                    groupName = '팔';
                }
            } else if (boneName.includes('Leg') || boneName.includes('leg')) {
                if (boneName.includes('Left') || boneName.includes('left') || boneName.includes('L_')) {
                    groupName = '왼쪽 다리';
                } else if (boneName.includes('Right') || boneName.includes('right') || boneName.includes('R_')) {
                    groupName = '오른쪽 다리';
                } else {
                    groupName = '다리';
                }
            }
            
            // 그룹에 본 추가
            if (!this.boneGroups[groupName]) {
                this.boneGroups[groupName] = [];
            }
            this.boneGroups[groupName].push(bone);
        });
    }
    
    getBoneGroups() {
        return this.boneGroups;
    }
    
    getBones() {
        return this.bones;
    }
    
    getOriginalRotations() {
        return this.originalBoneRotations;
    }
    
    resetBoneRotation(boneUuid) {
        const bone = this.bones.find(b => b.uuid === boneUuid);
        const originalRotation = this.originalBoneRotations.get(boneUuid);
        
        if (bone && originalRotation) {
            bone.rotation.x = originalRotation.x;
            bone.rotation.y = originalRotation.y;
            bone.rotation.z = originalRotation.z;
            return true;
        }
        
        return false;
    }
    
    updateBoneRotation(boneUuid, axis, value) {
        const bone = this.bones.find(b => b.uuid === boneUuid);
        
        if (bone && ['x', 'y', 'z'].includes(axis)) {
            bone.rotation[axis] = value;
            return true;
        }
        
        return false;
    }
}