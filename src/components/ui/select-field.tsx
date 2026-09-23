import type {SelectHTMLAttributes} from 'react';
export function SelectField({label,children,id,name,className='',...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string}){const inputId=id??name;return <label className="form-field" htmlFor={inputId}><span>{label}</span><select {...props} className={`select-field ${className}`.trim()} id={inputId} name={name}>{children}</select></label>}
