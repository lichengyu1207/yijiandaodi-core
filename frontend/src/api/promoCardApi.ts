import axios from 'axios';

const PROMO_API_BASE = '/api/recommendation';

const promoApi = axios.create({
  baseURL: PROMO_API_BASE,
  timeout: 8000,
});

promoApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[PromoCard API] Error:', error);
    return Promise.reject(error);
  }
);

export interface PromoCardItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  card_type: string;
  position: string;
  icon_name: string;
  icon_color: string;
  bg_color: string;
  border_color: string;
  accent_color: string;
  image_url: string;
  link_url: string;
  button_text: string;
  price_text: string;
  priority: number;
  status: string;
  is_active: boolean;
  card_type_display?: string;
  position_display?: string;
}

export const getFeedPromoCards = async (position: string = 'feed_middle', limit: number = 3) => {
  return promoApi.get('/promo-card/feed-cards/', { params: { position, limit } });
};

export const trackPromoClick = async (cardId: number) => {
  return promoApi.post('/promo-card/track-click/', { card_id: cardId });
};

export default promoApi;
