import {forwardRef,type InputHTMLAttributes} from 'react';

type TextInputProps=InputHTMLAttributes<HTMLInputElement> & {label:string};
export const TextInput=forwardRef<HTMLInputElement,TextInputProps>(function TextInput({label,id,name,className='',...props},ref){const inputId=id??name;return <label className="form-field" htmlFor={inputId}><span>{label}</span><input {...props} className={`text-input ${className}`.trim()} id={inputId} name={name} ref={ref}/></label>});
