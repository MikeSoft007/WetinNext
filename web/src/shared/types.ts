export type Profile = {
  career_track?:
    | "auto"
    | "infrastructure"
    | "data"
    | "frontend"
    | "backend"
    | "cybersecurity"
    | "marketing"
    | "support"
    | "project"
    | "scholarship"
    | "foundation";
  name: string;
  learner_type: string;
  country: string;
  goal: string;
  hours: number;
  device: string;
  background: string;
  low_data: boolean;
};
export type Week = {
  description?: string;
  learning_objectives?: string[];
  resource_guidance?: string;
  week: number;
  title: string;
  task: string;
  success: string;
  resource_id: string;
  minutes: number;
};
export type Progress = Record<
  string,
  { status: string; note: string; advice: string; updated_at?: string }
>;
export type State = {
  goal_id?: string | null;
  needs_goal_research?: boolean;
  profile: Partial<Profile>;
  plan: null | {
    id?: string | null;
    resources?: Resource[];
    research_id?: string | null;
    title: string;
    outcome: string;
    weeks: Week[];
    engine: string;
    notice: string;
    research_guide?: {
      qualification_route?: string;
      orientation?: string;
      places?: {
        name: string;
        kind: string;
        location: string;
        url: string;
        entry_route: string;
        cost_note?: string;
        availability_note?: string;
      }[];
      opportunities?: {
        title: string;
        provider: string;
        location: string;
        url: string;
        type: string;
        eligibility: string;
        deadline_note: string;
        availability_note: string;
        required_skills?: string[];
      }[];
    };
  };
  progress: Progress;
  applications: Record<string, string>;
  metrics?: { weekly_streak: number };
};
export type Resource = {
  price_amount?: number | null;
  price_currency?: string | null;
  location?: string | null;
  data_usage?: string;
  low_data_suitable?: boolean;
  data_note?: string;
  learning_outcomes?: string[];
  skills?: string[];
  sample_exercise?: string;
  suggested_session_minutes?: number;
  prerequisites?: string;
  id: string;
  title: string;
  provider: string;
  url: string;
  format: string;
  device: string;
  cost: string;
  review: string;
};
export type Opportunity = {
  source_changed_at?: string | null;
  source_changed_fields?: string[];
  availability?: string;
  last_checked_at?: string | null;
  last_check_result?: string | null;
  source?: string | null;
  id: string;
  title: string;
  organisation: string;
  type: string;
  country: string;
  skills: string[];
  description: string;
  mandatory: string;
  sample: boolean;
  url: string | null;
  deadline: string | null;
};
export type Assessment = {
  engine?: string;
  minutes?: number | null;
  fallback_reason?: string | null;
  learning_resources?: { resource: Resource; reason: string }[];
  label: string;
  strength: string;
  gap: string;
  actions: string[];
  notice: string;
  supported: { requirement: string; evidence: string }[];
  gaps: { requirement: string; reason: string }[];
  honest_guide: string[];
  deadline_notice: string;
};

export type HistoryEntry = {
  week: number;
  status: string;
  note: string;
  advice: string;
  updated_at?: string;
  legacy?: boolean;
};
