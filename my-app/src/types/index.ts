export type Template = {
  template_id: string;
  template_name: string;
  created_time?: number;
};

export type TemplateField = {
  field_id: string;
  field_label?: string;
  field_type?: string;
  is_mandatory?: boolean;
  default_value?: string | null;
  // optional layout info if you need it later
  page_no?: number;
  x_coord?: number;
  y_coord?: number;
};

export type ActionField = {
  field_id: string;
  field_category?: string;
  field_label?: string;
  page_no?: number;
  is_mandatory?: boolean;
  date_format?: string;
  time_zone?: string;
  time_zone_offset?: number;
};

export type TemplateAction = {
  action_id: string;
  action_type: "SIGN" | "VIEW" | "APPROVE";
  role?: string;
  recipient_name: string;
  recipient_email: string;
  signing_order?: number;
  verify_recipient?: boolean;
  verification_type?: string;
  fields?: ActionField[];
  delivery_mode?: string;
};

export type TemplateDetails = {
  template_id: string;
  template_name: string;
  actions: TemplateAction[];
  document_fields: TemplateField[];
  // meta
  owner_email?: string;
  created_time?: number;
};

type Editable = {
  template_id: string;
  template_name?: string;
  actions?: Array<{
    action_id: string;
    action_type?: string;
    recipient_name?: string;
    recipient_email?: string;
    role?: string;
    verify_recipient?: boolean;
    verification_type?: string;
  }>;
  // optional prefill maps
  field_text_data?: Record<string, string>;
  field_boolean_data?: Record<string, boolean>;
  field_date_data?: Record<string, string>;
};
