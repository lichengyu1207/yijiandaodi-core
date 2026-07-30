import request from '@/utils/request';

export interface CreatorProfileData {
  id: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  is_verified: boolean;
  tip_enabled: boolean;
  min_tip_amount: string;
  suggested_amounts: number[];
  thank_you_message: string;
  custom_goal: string;
  goal_amount: string | null;
  total_tips_count: number;
  total_tips_amount: string;
  unique_supporters: number;
  social_links: Record<string, string>;
}

export interface TipDonationItem {
  id: string;
  creator: string;
  creator_display_name?: string;
  supporter?: number | null;
  amount: string;
  currency: string;
  message: string;
  is_anonymous: boolean;
  supporter_display_name: string;
  source_page: string;
  source_id: string;
  status: string;
  payment_method: string;
  transaction_id: string;
  creator_reply: string;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatorStatsResponse {
  profile: CreatorProfileData;
  recent_tips: TipDonationItem[];
  monthly_stats: { count: number; amount: string };
  source_breakdown: Array<{ source_page: string; count: number; total: string }>;
  is_new_creator: boolean;
}

export interface LeaderboardItem {
  rank: number;
  creator_id: string;
  display_name: string;
  avatar_url: string;
  is_verified: boolean;
  bio: string;
  total_tips_count: number;
  unique_supporters: number;
  total_amount: string;
  custom_goal: string;
  goal_progress: number | null;
}

export interface LeaderboardResponse {
  period: string;
  creators: LeaderboardItem[];
  count: number;
}

export interface TipFeedItem {
  id: string;
  amount: string;
  message: string;
  supporter_name: string;
  creator_name: string;
  creator_avatar: string;
  source_page: string;
  created_at: string;
  has_reply: boolean;
}

export interface MyTipsResponse {
  tips: TipDonationItem[];
  total_sent: number;
  total_amount: string;
}

const tippingApi = {
  tip: {
    send: (data: {
      creator_id: string;
      amount: number | string;
      message?: string;
      is_anonymous?: boolean;
      source_page?: string;
      source_id?: string;
      payment_method?: string;
      supporter_display_name?: string;
    }) =>
      request.post('/api/tipping/tip-donation/send_tip/', data),

    reply: (tipId: string, reply: string) =>
      request.post(`/api/tipping/tip-donation/${tipId}/reply_tip/`, { reply }),

    myTips: () =>
      request.get('/api/tipping/tip-donation/my_tips/'),

    creatorStats: () =>
      request.get('/api/tipping/tip-donation/creator_stats/'),

    leaderboard: (params?: { period?: string; limit?: number }) =>
      request.get('/api/tipping/tip-donation/leaderboard/', { params }),

    feedTips: (params?: { limit?: number }) =>
      request.get('/api/tipping/tip-donation/feed_tips/', { params }),
  },
};

export default tippingApi;
