-- Reference data: faculties and document types, exported from production on 2026-09-28.
-- Contains no student or admin data. Adjust names/prices per institution (all prices are THB).

BEGIN;
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (110, '[E11] หนังสือรับรองอื่น ๆ [อังกฤษ]', '[E11] Other Certificates [English]', '[E11] 其他证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (111, '[T11] หนังสือรับรองอื่น ๆ [ไทย]', '[T11] Other Certificates [Thai]', '[T11] 其他证明 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (50, '[E05] หนังสือรับรองคาดว่าจะสำเร็จการศึกษา [อังกฤษ]', '[E05] Certificate of Expected Graduation [English]', '[E05] 预计毕业证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (51, '[T05] หนังสือรับรองคาดว่าจะสำเร็จการศึกษา [ไทย]', '[T05] Certificate of Expected Graduation [Thai]', '[T05] 预计毕业证明 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (60, '[E06] หนังสือรับรองฉบับรอสภาอนุมัติสำเร็จการศึกษา [อังกฤษ]', '[E06] Certificate of completion awaiting council approval [English]', '[E06] 完成证书正在等待理事会批准  [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (61, '[T06] หนังสือรับรองฉบับรอสภาอนุมัติสำเร็จการศึกษา [ไทย]', '[T06] Certificate of completion awaiting council approval [Thai]', '[T06] 完成证书正在等待理事会批准  [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (40, '[E04] หนังสือรับรองการเป็นนักศึกษา [อังกฤษ]', '[E04] Student Certificate [English]', '[E04] 学生证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (41, '[T04] หนังสือรับรองการเป็นนักศึกษา [ไทย]', '[T04] Student Certificate [Thai]', '[T04] 学生证明 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (20, '[E02] ใบแสดงผลการศึกษา  ฉบับก่อนสภาอนุมัติสำเร็จการศึกษา[อังกฤษ]', '[E02] Provisional Transcript (Pending University Council Approval)[English]', '[E02] 临时成绩单（待理事会批准毕业）[英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (21, '[T02] ใบแสดงผลการศึกษา ฉบับก่อนสภาอนุมัติสำเร็จการศึกษา[ไทย]', '[T02] Provisional Transcript (Pending University Council Approval) [Thai]', '[T02] 临时成绩单（待理事会批准毕业） [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (30, '[E03] ใบแสดงผลการศึกษา ฉบับหลังสภาอนุมัติปริญญา [อังกฤษ]', '[E03] Official Transcript (Degree Conferred / Approved by University Council) [English]', '[E03] 正式成绩单（已获学位） [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (31, '[T03] ใบแสดงผลการศึกษา ฉบับหลังสภาอนุมัติปริญญา[ไทย]', '[T03] Official Transcript (Degree Conferred / Approved by University Council)  [Thai]', '[T03] 正式成绩单（已获学位）[泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (10, '[E01] ใบแสดงผลการศึกษา ฉบับกำลังศึกษา [อังกฤษ]', '[E01] Transcript [English]', '[E01] 成绩单 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (11, '[T01] ใบแสดงผลการศึกษา  ฉบับกำลังศึกษา [ไทย]', '[T01] Transcript [Thai]', '[T01] 成绩单 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (70, '[E07] หนังสือรับรองการสำเร็จการศึกษา [อังกฤษ]', '[E07] Certificate of Graduation [English]', '[E07] 毕业证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (71, '[T07] หนังสือรับรองการสำเร็จการศึกษา [ไทย]', '[T07] Certificate of Graduation  [Thai]', '[T07] 毕业证明 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (91, '[T09] สำเนาใบปริญญาบัตร [ไทย]', '[T09] Copy of Degree Certificate [Thai]', '[T09] 学位证书副本 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (80, '[E08] หนังสือรับรองรายวิชา [อังกฤษ]', '[E08] Course Certificate [English]', '[E08] 课程证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (81, '[T08] หนังสือรับรองรายวิชา [ไทย]', '[T08] Course Certificate [Thai]', '[T08] 课程证明 [泰语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (90, '[E09] สำเนาใบปริญญาบัตร [อังกฤษ]', '[E09] Copy of Degree Certificate [English]', '[E09] 学位证书副本 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (100, '[E10] หนังสือรับรองความประพฤติ [อังกฤษ]', '[E10] Certificate of Good Conduct [English]', '[E10] 品行证明 [英语]', 100.00);
INSERT INTO public.document_types (id, name_th, name_en, name_zh, price) VALUES (101, '[T10] หนังสือรับรองความประพฤติ [ไทย]', '[T10] Certificate of Good Conduct [Thai]', '[T10] 品行证明 [泰语]', 100.00);
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (1, 'คณะบริหารธุรกิจ', 'Faculty of Business Administration', '工商管理学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (4, 'คณะศิลปศาสตร์', 'Faculty of Liberal Arts', '文学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (2, 'คณะเทคโนโลยีและนวัตกรรมดิจิทัล', 'Faculty of Digital Technology and Innovation', '数字技术与创新学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (3, 'คณะรัฐศาสตร์', 'Faculty of Political Science', '政治学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (5, 'คณะนิเทศศาสตร์', 'Faculty of Communication Arts', '传播艺术学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (6, 'คณะศึกษาศาสตร์', 'Faculty of Education', '教育学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (7, 'คณะพยาบาลศาสตร์', 'Faculty of Nursing', '护理学院');
INSERT INTO public.faculties (id, name_th, name_en, name_zh) VALUES (8, 'วิทยาลัยนานาชาติ', 'International College ', '国际学院');

SELECT setval('public.faculties_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.faculties));
SELECT setval('public.document_types_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.document_types));
COMMIT;
