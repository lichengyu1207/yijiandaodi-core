from django.urls import path

from .user_behavior_views import UserBehaviorViewSet
from .promo_card_views import PromoCardViewSet

rec_view = UserBehaviorViewSet.as_view({'post': 'track'})
rec_list = UserBehaviorViewSet.as_view({'get': 'recommendations'})
hot_skills = UserBehaviorViewSet.as_view({'get': 'hot_skills'})
new_for_you = UserBehaviorViewSet.as_view({'get': 'new_for_you'})
similar = UserBehaviorViewSet.as_view({'get': 'similar_skills'})
detector_engines = UserBehaviorViewSet.as_view({'get': 'detector_engines'})

feed_cards_view = PromoCardViewSet.as_view({'get': 'feed_cards'})
track_click_view = PromoCardViewSet.as_view({'post': 'track_click'})

urlpatterns = [
    path('track/', rec_view, name='rec-track'),
    path('recommendations/', rec_list, name='rec-recommendations'),
    path('hot-skills/', hot_skills, name='rec-hot-skills'),
    path('new-for-you/', new_for_you, name='rec-new-for-you'),
    path('similar-skills/', similar, name='rec-similar-skills'),
    path('detector-engines/', detector_engines, name='rec-detector-engines'),
    path('promo-card/feed-cards/', feed_cards_view, name='promo-card-feed-cards'),
    path('promo-card/track-click/', track_click_view, name='promo-card-track-click'),
]
