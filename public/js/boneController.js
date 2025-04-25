// boneController.js - 본 제어 및 관리
import * as THREE from 'three';

export class BoneController {
    constructor() {
        this.bones = [];
        this.originalRotations = new Map();
        this.boneGroups = {};
    }
    
    setBones(bones) {
        this.bones = bones;
        
        // 본 원래 회전값 저장
        this.originalRotations.clear();
        bones.forEach(bone => {
            this.originalRotations.set(bone.uuid, {
                x: bone.rotation.x,
                y: bone.rotation.y,
                z: bone.rotation.z
            });
        });
        
        // 본 그룹화 실행
        this.groupBones();
        
        console.log(`${bones.length}개의 본 설정됨`);
    }
    
    getBones() {
        return this.bones;
    }
    
    getOriginalRotations() {
        return this.originalRotations;
    }
    
    getBoneGroups() {
        return this.boneGroups;
    }
    
    // 본 이름과 구조에 따른 그룹화
    groupBones() {
        this.boneGroups = {
            '루트/엉덩이': [],
            '머리': [],
            '몸통': [],
            '왼쪽 팔': [],
            '오른쪽 팔': [],
            '왼쪽 손/손가락': [],
            '오른쪽 손/손가락': [],
            '왼쪽 다리': [],
            '오른쪽 다리': [],
            '왼쪽 발/발가락': [],
            '오른쪽 발/발가락': [],
            '왼쪽': [],
            '오른쪽': [],
            '기타': []
        };
        
        const lowerWords = {
            left: '왼쪽',
            right: '오른쪽',
            l_: '왼쪽',
            r_: '오른쪽',
            l: '왼쪽',
            r: '오른쪽',
            _l_: '왼쪽',
            _r_: '오른쪽',
            '_l': '왼쪽',
            '_r': '오른쪽'
        };
        
        // 머리, 몸통 관련 단어
        const headWords = ['head', 'skull', 'neck', 'kopf'];
        const torsoWords = ['spine', 'chest', 'rib', 'hip', 'torso', 'pelvis', 'brust', 'bauch'];
        
        // 팔, 손 관련 단어
        const armWords = ['arm', 'shoulder', 'elbow', 'wrist', 'schulter'];
        const handWords = ['hand', 'finger', 'thumb', 'pinky', 'index', 'middle', 'ring'];
        
        // 다리, 발 관련 단어
        const legWords = ['leg', 'thigh', 'knee', 'shin', 'bein', 'schenkel'];
        const footWords = ['foot', 'toe', 'ankle', 'fuss'];
        
        // 루트 관련 단어
        const rootWords = ['root', 'hip', 'pelvis', 'becken'];
        
        this.bones.forEach(bone => {
            const name = bone.name.toLowerCase();
            let assigned = false;
            
            // 루트 또는 부모가 null인 본
            if (!bone.parent || rootWords.some(word => name.includes(word))) {
                this.boneGroups['루트/엉덩이'].push(bone);
                assigned = true;
            } 
            // 머리 관련 본
            else if (headWords.some(word => name.includes(word))) {
                this.boneGroups['머리'].push(bone);
                assigned = true;
            } 
            // 몸통 관련 본
            else if (torsoWords.some(word => name.includes(word))) {
                this.boneGroups['몸통'].push(bone);
                assigned = true;
            } 
            else {
                // 왼쪽/오른쪽 구분
                let side = null;
                for (const [key, value] of Object.entries(lowerWords)) {
                    if (name.includes(key)) {
                        side = value;
                        break;
                    }
                }
                
                // 팔/손/다리/발 구분
                if (side) {
                    if (armWords.some(word => name.includes(word))) {
                        this.boneGroups[`${side} 팔`].push(bone);
                        assigned = true;
                    } else if (handWords.some(word => name.includes(word))) {
                        this.boneGroups[`${side} 손/손가락`].push(bone);
                        assigned = true;
                    } else if (legWords.some(word => name.includes(word))) {
                        this.boneGroups[`${side} 다리`].push(bone);
                        assigned = true;
                    } else if (footWords.some(word => name.includes(word))) {
                        this.boneGroups[`${side} 발/발가락`].push(bone);
                        assigned = true;
                    } else {
                        // 구체적인 파트를 알 수 없지만 왼쪽/오른쪽은 구분 가능
                        this.boneGroups[side].push(bone);
                        assigned = true;
                    }
                }
            }
            
            // 어디에도 할당되지 않았다면 '기타'로 분류
            if (!assigned) {
                this.boneGroups['기타'].push(bone);
            }
        });
        
        // 그룹별 본 개수 출력
        for (const [groupName, groupBones] of Object.entries(this.boneGroups)) {
            if (groupBones.length > 0) {
                console.log(`그룹 ${groupName}: ${groupBones.length}개 본`);
            }
        }
    }
    
    // 특정 본 회전 초기화
    resetBoneRotation(boneUuid) {
        const bone = this.bones.find(b => b.uuid === boneUuid);
        if (!bone) return false;
        
        const originalRotation = this.originalRotations.get(boneUuid);
        if (!originalRotation) return false;
        
        bone.rotation.x = originalRotation.x;
        bone.rotation.y = originalRotation.y;
        bone.rotation.z = originalRotation.z;
        
        return true;
    }
    
    // 모든 본 회전 초기화
    resetAllBoneRotations() {
        this.bones.forEach(bone => {
            this.resetBoneRotation(bone.uuid);
        });
    }
    
    // 특정 본 찾기
    findBoneByName(name) {
        return this.bones.find(bone => bone.name === name);
    }
    
    findBoneByUuid(uuid) {
        return this.bones.find(bone => bone.uuid === uuid);
    }
    
    // 계층 관계에 따른 본 회전 제어
    rotateBoneAndChildren(boneUuid, rotation) {
        const bone = this.findBoneByUuid(boneUuid);
        if (!bone) return false;
        
        // 현재 본 회전
        bone.rotation.x = rotation.x !== undefined ? rotation.x : bone.rotation.x;
        bone.rotation.y = rotation.y !== undefined ? rotation.y : bone.rotation.y;
        bone.rotation.z = rotation.z !== undefined ? rotation.z : bone.rotation.z;
        
        return true;
    }
}