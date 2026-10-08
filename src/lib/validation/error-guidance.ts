import type {ZodError} from 'zod';

export type ValidationReason = 'required' | 'email' | 'date' | 'selection' | 'number' | 'dateOrder' | 'dates' | 'guardian' | 'invalid';
export type ValidationIssue = {field: string; reason: ValidationReason; item?: number};

// Only safe field identifiers and validation categories travel back to browsers.
const names: Record<string, [string, string]> = {
  "firstNameEn": [
    "First name (English)",
    "الاسم الأول بالإنجليزية"
  ],
  "lastNameEn": [
    "Last name (English)",
    "اسم العائلة بالإنجليزية"
  ],
  "firstNameAr": [
    "First name (Arabic)",
    "الاسم الأول بالعربية"
  ],
  "lastNameAr": [
    "Last name (Arabic)",
    "اسم العائلة بالعربية"
  ],
  "nameEn": [
    "Name (English)",
    "الاسم بالإنجليزية"
  ],
  "nameAr": [
    "Name (Arabic)",
    "الاسم بالعربية"
  ],
  "name": [
    "Name",
    "الاسم"
  ],
  "displayName": [
    "Display name",
    "الاسم الظاهر"
  ],
  "email": [
    "Email address",
    "البريد الإلكتروني"
  ],
  "phone": [
    "Phone number",
    "رقم الهاتف"
  ],
  "guardianName": [
    "Guardian name",
    "اسم ولي الأمر"
  ],
  "guardianEmail": [
    "Guardian email",
    "بريد ولي الأمر"
  ],
  "guardianPhone": [
    "Guardian phone",
    "هاتف ولي الأمر"
  ],
  "guardianMode": [
    "Guardian option",
    "خيار ولي الأمر"
  ],
  "guardianId": [
    "Existing guardian",
    "ولي الأمر الحالي"
  ],
  "reportLanguage": [
    "Report language",
    "لغة التقرير"
  ],
  "preferredLanguage": [
    "Preferred language",
    "اللغة المفضلة"
  ],
  "defaultLanguage": [
    "Default language",
    "اللغة الافتراضية"
  ],
  "timezone": [
    "Time zone",
    "المنطقة الزمنية"
  ],
  "classId": [
    "Class",
    "الصف"
  ],
  "targetClassId": [
    "Destination class",
    "الصف المنقول إليه"
  ],
  "classSubjectId": [
    "Subject",
    "المادة"
  ],
  "subjectId": [
    "Subject",
    "المادة"
  ],
  "groupId": [
    "Subject group",
    "مجموعة المادة"
  ],
  "targetGroupId": [
    "Destination group",
    "المجموعة المنقول إليها"
  ],
  "teacherId": [
    "Teacher",
    "المعلم"
  ],
  "startsOn": [
    "Start date",
    "تاريخ البداية"
  ],
  "endsOn": [
    "End date",
    "تاريخ النهاية"
  ],
  "effectiveOn": [
    "Effective date",
    "تاريخ السريان"
  ],
  "weekStart": [
    "Teaching week",
    "أسبوع التدريس"
  ],
  "onDate": [
    "Teaching date",
    "تاريخ التدريس"
  ],
  "periodStart": [
    "Coverage start",
    "بداية فترة التغطية"
  ],
  "periodEnd": [
    "Coverage end",
    "نهاية فترة التغطية"
  ],
  "dates": [
    "Specific teaching dates",
    "تواريخ التدريس المحددة"
  ],
  "coverageKind": [
    "Coverage type",
    "نوع التغطية"
  ],
  "subjects": [
    "Subject selection",
    "اختيار المواد"
  ],
  "attendance": [
    "Student attendance",
    "حضور الطلاب"
  ],
  "exceptions": [
    "Individual student notes",
    "ملاحظات الطلاب الفردية"
  ],
  "progressEn": [
    "Progress (English)",
    "التقدم الدراسي بالإنجليزية"
  ],
  "progressAr": [
    "Progress (Arabic)",
    "التقدم الدراسي بالعربية"
  ],
  "defaultPerformance": [
    "Default performance",
    "الأداء الافتراضي"
  ],
  "status": [
    "Attendance status",
    "حالة الحضور"
  ],
  "mainReportLabelEn": [
    "Main report heading (English)",
    "عنوان التقرير الرئيسي بالإنجليزية"
  ],
  "mainReportLabelAr": [
    "Main report heading (Arabic)",
    "عنوان التقرير الرئيسي بالعربية"
  ],
  "performanceLabelEn": [
    "Performance heading (English)",
    "عنوان الأداء بالإنجليزية"
  ],
  "performanceLabelAr": [
    "Performance heading (Arabic)",
    "عنوان الأداء بالعربية"
  ],
  "studentCommentLabelEn": [
    "Comment heading (English)",
    "عنوان الملاحظات بالإنجليزية"
  ],
  "studentCommentLabelAr": [
    "Comment heading (Arabic)",
    "عنوان الملاحظات بالعربية"
  ],
  "emailSubjectEn": [
    "Email subject (English)",
    "موضوع البريد بالإنجليزية"
  ],
  "emailSubjectAr": [
    "Email subject (Arabic)",
    "موضوع البريد بالعربية"
  ]
};
const explanations: Record<ValidationReason, [string, string]> = {
  "required": [
    "Enter a value.",
    "أدخل قيمة."
  ],
  "email": [
    "Enter a valid email address, such as name@example.com.",
    "أدخل بريدًا إلكترونيًا صالحًا مثل name@example.com."
  ],
  "date": [
    "Choose a valid date.",
    "اختر تاريخًا صالحًا."
  ],
  "selection": [
    "Choose a valid option.",
    "اختر خيارًا صالحًا."
  ],
  "number": [
    "Enter a non-negative whole number.",
    "أدخل عددًا صحيحًا غير سالب."
  ],
  "dateOrder": [
    "The end date must not be before the start date.",
    "يجب ألا يسبق تاريخ النهاية تاريخ البداية."
  ],
  "dates": [
    "Select teaching dates within the coverage range.",
    "حدد تواريخ التدريس ضمن فترة التغطية."
  ],
  "guardian": [
    "Complete the selected guardian option, or choose a different option.",
    "أكمل بيانات خيار ولي الأمر المحدد أو اختر خيارًا آخر."
  ],
  "invalid": [
    "Review and correct this value.",
    "راجع هذه القيمة وصححها."
  ]
};

export function validationIssues(error: ZodError): ValidationIssue[] {
  const result: ValidationIssue[] = [];
  const seen = new Set<string>();
  for (const issue of error.issues) {
    const first = issue.path[0];
    const field = typeof first === 'string' && first in names ? first : 'form';
    const item = typeof issue.path[1] === 'number' ? issue.path[1] + 1 : undefined;
    const key = `${field}:${item ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    let reason: ValidationReason = 'invalid';
    if (issue.code === 'custom') {
      if (/end date|end must|precede its start/i.test(issue.message)) reason = 'dateOrder';
      else if (/exact date/i.test(issue.message)) reason = 'dates';
      else if (/guardian/i.test(issue.message)) reason = 'guardian';
      else reason = 'selection';
    } else if (issue.code === 'invalid_format') {
      const format = 'format' in issue ? String(issue.format) : '';
      reason = format === 'email' ? 'email' : /date/i.test(format) ? 'date' : 'selection';
    } else if (issue.code === 'invalid_value') {
      reason = 'selection';
    } else if (issue.code === 'too_small' || issue.code === 'invalid_type') {
      reason = /^(startsOn|endsOn|effectiveOn|periodStart|periodEnd|weekStart|onDate)$/.test(field)
        ? 'date' : field === 'attendance' ? 'number' : 'required';
    } else if (/^(startsOn|endsOn|effectiveOn|periodStart|periodEnd|weekStart|onDate)$/.test(field)) {
      reason = 'date';
    }
    result.push({field, reason, ...(item ? {item} : {})});
    if (result.length === 8) break;
  }
  return result;
}

export function formatValidationIssue(issue: ValidationIssue, locale: string) {
  const arabic = locale === 'ar';
  const index = arabic ? 1 : 0;
  const name = names[issue.field]?.[index] ?? (arabic ? 'بيانات النموذج' : 'Form details');
  const item = issue.item ? (arabic ? ` (العنصر ${issue.item})` : ` (item ${issue.item})`) : '';
  return `${name}${item}: ${explanations[issue.reason][index]}`;
}
