export type SubjectDefinition={id:string;defaultGroupId:string|null;active:boolean};
export type StudentSubjectState={classSubjectId:string;excluded:boolean;groupId:string|null};
export function initializeSubjectParticipation(subjects:SubjectDefinition[],existing:StudentSubjectState[]=[]):StudentSubjectState[]{const byId=new Map(existing.map(item=>[item.classSubjectId,item]));return subjects.filter(s=>s.active).map(subject=>byId.get(subject.id)??{classSubjectId:subject.id,excluded:false,groupId:subject.defaultGroupId});}
export function changeDefaultGroup(subjects:StudentSubjectState[]){return subjects.map(subject=>({...subject}));}
