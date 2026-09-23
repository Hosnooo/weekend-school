export type TeacherSource={id:string;progressEn:string|null;progressAr:string|null};
export type OfficialContent={progressEn:string|null;progressAr:string|null};
export function composeOfficialContent(sources:TeacherSource[],selectedIds:string[],custom:Partial<OfficialContent>={}):OfficialContent{const selected=sources.filter(source=>selectedIds.includes(source.id));return{progressEn:custom.progressEn??(selected.map(s=>s.progressEn).filter(Boolean).join('\n\n')||null),progressAr:custom.progressAr??(selected.map(s=>s.progressAr).filter(Boolean).join('\n\n')||null)}}
