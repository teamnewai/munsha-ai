// مُلكي — أنواع مطابقة للمخطّط الحقيقي في Supabase (مشروع mulki-reos)
// مُستخرجة من information_schema (قراءة فقط). تشمل الجداول التي تعرضها الواجهة.

export interface Organization {
  id: string;
  name: string;
  client_type: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  verification_status: string | null;
  brand_logo_url: string | null;
  brand_color: string | null;
  membership_no: string | null;
  is_demo: boolean | null;
  created_at: string;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  permissions: string[] | null;
  created_at: string;
}

export interface OrgDepartment {
  id: string;
  org_id: string;
  dept_key: string;
  name: string;
  icon: string | null;
  color: string | null;
  operation_type: string | null;
  staff_count: number | null;
  open_tasks: number | null;
  done_tasks: number | null;
  perf: number | null;
  mission: string | null;
  active: boolean | null;
  sort: number | null;
}

export interface DeptMember {
  id: string;
  org_id: string;
  dept_key: string;
  full_name: string | null;
  job_title: string | null;
  present: boolean | null;
  status: string | null;
  section: string | null;
  avatar_url: string | null;
}

export interface Property {
  id: string;
  org_id: string;
  ref_code: string | null;
  name: string;
  city: string | null;
  district: string | null;
  national_address: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  org_id: string;
  property_id: string | null;
  unit_no: string | null;
  unit_type: string | null;
  area: number | null;
  occupancy: string | null; // vacant | occupied | ...
}

export interface Contract {
  id: string;
  org_id: string;
  unit_id: string | null;
  tenant_id: string | null;
  owner_id: string | null;
  annual_rent: number | null;
  period: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

export interface Invoice {
  id: string;
  org_id: string;
  unit_id: string | null;
  party_id: string | null;
  amount: number | null;
  due_date: string | null;
  status: string | null; // pending | paid | overdue ...
}

export interface MaintenanceRequest {
  id: string;
  org_id: string;
  unit_id: string | null;
  title: string | null;
  description: string | null;
  status: string | null;
  estimated_cost: number | null;
  approval_level: string | null; // auto | manager | owner
  created_at: string;
}

export interface Lead {
  id: string;
  kind: string | null;
  city: string | null;
  region: string | null;
  unit_type: string | null;
  budget_max: number | null;
  service_category: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: string | null;
  score: number | null;
  created_at: string;
}

export interface ServiceProvider {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  category: string | null;
  composite_score: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  org_id: string;
  invoice_id: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  paid_on: string | null;
}

export interface LedgerEntry {
  id: string;
  org_id: string;
  entry_type: string | null;
  category: string | null;
  amount: number | null;
  vat_amount: number | null;
  occurred_on: string | null;
}

export interface Community {
  id: string;
  org_id: string;
  property_id: string | null;
  name: string;
  created_at: string;
}

export interface HoaFee {
  id: string;
  org_id: string;
  community_id: string | null;
  unit_id: string | null;
  amount: number | null;
  due_date: string | null;
  status: string | null;
}
