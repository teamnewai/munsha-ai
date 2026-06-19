-- مُلكي — إضافة معامل الموظفين الفعليين إلى generate_org (يكتبهم في dept_members)
-- خطوة المخطط (5): إدخال يدوي أو رفع إكسل يُقرأ ويُبنى على أساسه.
drop function if exists public.generate_org(jsonb, jsonb, text);

create or replace function public.generate_org(
  p_input jsonb,
  p_structure jsonb,
  p_source text default 'local',
  p_employees jsonb default '[]'::jsonb
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  v_org uuid; v_role text; v_doc uuid;
  dep jsonb; sec jsonb; rol jsonb; emp jsonb;
  v_sort int := 0; v_emp_count int := 0;
  v_depts jsonb := coalesce(p_structure->'departments', '[]'::jsonb);
begin
  if uid is null then return json_build_object('ok', false, 'reason', 'auth'); end if;

  select org_id, role into v_org, v_role
  from memberships where user_id = uid order by (role = 'owner') desc limit 1;

  if v_org is null then return json_build_object('ok', false, 'reason', 'no_org'); end if;
  if v_role <> 'owner' then return json_build_object('ok', false, 'reason', 'not_owner'); end if;

  insert into org_structure_docs (org_id, source, input, structure, doc_no)
  values (v_org, coalesce(p_source, 'local'), coalesce(p_input, '{}'::jsonb), v_depts,
          'STR-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(v_org::text, '-', ''), 1, 4)))
  returning id into v_doc;

  insert into approvals (org_id, request_id, decision, decided_by, reason)
  values (v_org, v_doc, 'approved', uid, 'اعتماد المالك لبناء الهيكل التنظيمي');

  for dep in select * from jsonb_array_elements(v_depts) loop
    if not exists (select 1 from org_departments where org_id = v_org and dept_key = dep->>'key') then
      insert into org_departments (org_id, dept_key, name, icon, sort)
      values (v_org, dep->>'key', dep->>'name', coalesce(nullif(dep->>'icon', ''), '🏢'), v_sort);
    end if;
    for sec in select * from jsonb_array_elements(coalesce(dep->'sections', '[]'::jsonb)) loop
      if not exists (select 1 from org_sections where org_id = v_org and dept_key = dep->>'key' and name = sec->>'name') then
        insert into org_sections (org_id, dept_key, name) values (v_org, dep->>'key', sec->>'name');
      end if;
    end loop;
    for rol in select * from jsonb_array_elements(coalesce(dep->'roles', '[]'::jsonb)) loop
      if not exists (select 1 from org_roles where org_id = v_org and dept_key = dep->>'key' and title = (rol #>> '{}')) then
        insert into org_roles (org_id, dept_key, title) values (v_org, dep->>'key', rol #>> '{}');
      end if;
    end loop;
    v_sort := v_sort + 1;
  end loop;

  -- الموظفون الفعليون → dept_members (يدوي أو من إكسل)
  for emp in select * from jsonb_array_elements(coalesce(p_employees, '[]'::jsonb)) loop
    if coalesce(trim(emp->>'full_name'), '') <> '' then
      insert into dept_members (org_id, dept_key, full_name, email, job_title, section, status, present)
      values (v_org, coalesce(nullif(emp->>'dept_key', ''), 'management'),
              trim(emp->>'full_name'), nullif(trim(emp->>'email'), ''),
              nullif(trim(emp->>'job_title'), ''), nullif(trim(emp->>'section'), ''), 'active', false);
      v_emp_count := v_emp_count + 1;
    end if;
  end loop;

  update org_office set setup_done = true where org_id = v_org;
  if not found then insert into org_office (org_id, setup_done) values (v_org, true); end if;

  return json_build_object('ok', true, 'org_id', v_org, 'doc_id', v_doc,
                           'departments', jsonb_array_length(v_depts), 'employees', v_emp_count);
end;
$function$;
