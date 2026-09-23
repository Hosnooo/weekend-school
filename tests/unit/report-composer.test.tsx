import {render,screen} from '@testing-library/react';
import {describe,expect,it} from 'vitest';

import {
  composeReportSectionApproval,
  ReportComposer,
  resolveStudentSectionApproval
} from '@/features/reports/report-composer';

const sources=[
  {id:'source-1',teacherName:'Teacher One',progressEn:'Letters and sounds',progressAr:null,performance:'GOOD' as const,commentEn:'Participates well',commentAr:null},
  {id:'source-2',teacherName:'Teacher Two',progressEn:'Reading short words',progressAr:'قراءة كلمات قصيرة',performance:'EXCELLENT' as const,commentEn:null,commentAr:'تقدم جيد'}
];

describe('report composer',()=>{
  it('can compose official shared content from multiple selected teacher source blocks',()=>{
    const composition=composeReportSectionApproval({
      mode:'sources',
      sources,
      selectedSourceIds:['source-1','source-2'],
      customProgressEn:null,
      customProgressAr:null,
      performance:'GOOD',
      commentEn:'Shared admin note',
      commentAr:null,
      studentOverrides:[]
    });
    expect(composition.shared.approvedProgressEn).toBe('Letters and sounds\n\nReading short words');
    expect(composition.shared.approvedProgressAr).toBe('قراءة كلمات قصيرة');
    expect(composition.shared.performance).toBe('GOOD');
  });

  it('can use custom official wording instead of teacher source text',()=>{
    const composition=composeReportSectionApproval({
      mode:'custom',
      sources,
      selectedSourceIds:['source-1'],
      customProgressEn:'Official curriculum summary',
      customProgressAr:'ملخص المنهج الرسمي',
      performance:'EXCELLENT',
      commentEn:null,
      commentAr:null,
      studentOverrides:[]
    });
    expect(composition.shared.approvedProgressEn).toBe('Official curriculum summary');
    expect(composition.shared.approvedProgressAr).toBe('ملخص المنهج الرسمي');
  });

  it('applies shared content to all students but isolates a personalized override to its chosen student',()=>{
    const composition=composeReportSectionApproval({
      mode:'sources',
      sources,
      selectedSourceIds:['source-1'],
      customProgressEn:null,
      customProgressAr:null,
      performance:'GOOD',
      commentEn:'Shared admin note',
      commentAr:null,
      studentOverrides:[{
        studentId:'student-1',
        progressEn:'Personalized progress',
        progressAr:null,
        performance:'EXCELLENT',
        commentEn:'Personalized note',
        commentAr:null
      }]
    });

    expect(resolveStudentSectionApproval(composition,'student-1')).toMatchObject({
      approvedProgressEn:'Personalized progress',
      performance:'EXCELLENT',
      commentEn:'Shared admin note\n\nPersonalized note'
    });
    expect(resolveStudentSectionApproval(composition,'student-2')).toMatchObject({
      approvedProgressEn:'Letters and sounds',
      performance:'GOOD',
      commentEn:'Shared admin note'
    });
  });

  it('shows source selection and custom official text controls in the admin composer',()=>{
    render(<ReportComposer sources={sources}/>);
    expect(screen.getByRole('checkbox',{name:/Teacher One/})).toBeVisible();
    expect(screen.getByRole('checkbox',{name:/Teacher Two/})).toBeVisible();
    expect(screen.getByLabelText('Custom official progress (English)')).toBeVisible();
    expect(screen.getByLabelText('Custom official progress (Arabic)')).toBeVisible();
  });
});
