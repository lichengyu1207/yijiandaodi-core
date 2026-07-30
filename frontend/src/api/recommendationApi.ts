import axios from 'axios';

const REC_API_BASE = '/api/recommendation';

const recApi = axios.create({
  baseURL: REC_API_BASE,
  timeout: 10000,
});

recApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

recApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Recommendation API] Error:', error);
    return Promise.reject(error);
  }
);

export interface RecommendationItem {
  id: number;
  name: string;
  category: string;
  main_scenario: string;
  keywords: string[];
  weight: number;
  dev_days: number;
  monetization_type: string;
  tier: string;
  icon_name: string;
  icon_color: string;
  description: string;
  is_recommended: boolean;
  is_hot: boolean;
  is_new: boolean;
  usage_count: number;
  tier_label?: string;
  monetization_label?: string;
  rec_reason: string;
  rec_score: number;
}

export interface UserProfileData {
  id: number;
  username: string;
  preferred_tiers: string[];
  preferred_categories: string[];
  preferred_scenarios: string[];
  total_clicks: number;
  total_executions: number;
  active_days: number;
  is_vip: boolean;
  vip_level: number;
  conversion_count: number;
}

export interface RecommendationResponse {
  success: boolean;
  data: {
    recommendations: RecommendationItem[];
    total: number;
    user_is_active: boolean;
    user_profile: UserProfileData | null;
    strategy_used: string;
    algorithm_version: string;
  };
}

export interface HotSkillsResponse {
  success: boolean;
  data: {
    hot_skills: RecommendationItem[];
    count: number;
  };
}

export interface NewForYouResponse {
  success: boolean;
  data: {
    new_skills: RecommendationItem[];
    count: number;
    is_active_user: boolean;
  };
}

export interface SimilarSkillsResponse {
  success: boolean;
  data: {
    reference_skill: string;
    similar_skills: RecommendationItem[];
    count: number;
  };
}

export interface DetectorEnginesResponse {
  success: boolean;
  message: string;
  data: {
    detector_engines: (RecommendationItem & { is_detector_engine?: boolean; api_endpoint?: string; target_product?: string })[];
    count: number;
    engine_categories: {
      [key: string]: { name: string; engines: string[] };
    };
  };
}

export interface BehaviorLogEntry {
  target_type: string;
  target_id: number;
  action: string;
  skill_tier?: string;
  skill_category?: string;
  scenario?: string;
  source_page?: string;
  duration_seconds?: number;
  extra_data?: Record<string, any>;
}

export const getRecommendations = async (limit: number = 30, strategy: string = 'auto'): Promise<RecommendationResponse> => {
  return recApi.get('/recommendations/', { params: { limit, strategy } });
};

export const getHotSkills = async (limit: number = 20): Promise<HotSkillsResponse> => {
  return recApi.get('/hot-skills/', { params: { limit } });
};

export const getNewForYou = async (limit: number = 15): Promise<NewForYouResponse> => {
  return recApi.get('/new-for-you/', { params: { limit } });
};

export const getSimilarSkills = async (skillId: number, limit: number = 10): Promise<SimilarSkillsResponse> => {
  return recApi.get('/similar-skills/', { params: { skill_id: skillId, limit } });
};

export const getDetectorEngines = async (): Promise<DetectorEnginesResponse> => {
  return recApi.get('/detector-engines/');
};

export const trackBehavior = async (logs: BehaviorLogEntry[], sessionId: string = '') => {
  return recApi.post('/track/', { logs, session_id: sessionId || '' });
};

export const trackSkillClick = (skillId: number, skill: any) => {
  const logs: BehaviorLogEntry[] = [{
    target_type: 'skill',
    target_id: skillId,
    action: 'click',
    skill_tier: skill.tier || '',
    skill_category: skill.category || '',
    scenario: skill.main_scenario || skill.mainScenario || '',
    source_page: 'skill_selector_panel',
  }];
  return trackBehavior(logs);
};

export default recApi;
