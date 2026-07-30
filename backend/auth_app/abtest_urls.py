from django.urls import path
from .abtest_views import ABTestViewSet, PromoOptimizationViewSet

ab_viewset = ABTestViewSet()
promo_opt_viewset = PromoOptimizationViewSet()

urlpatterns = [
    # A/B Testing
    path('ab/experiments/', ab_viewset.experiments, name='ab-experiments'),
    path('ab/assign/', ab_viewset.assign, name='ab-assign'),
    path('ab/track-event/', ab_viewset.track_event, name='ab-track-event'),
    path('ab/results/', ab_viewset.results, name='ab-results'),
    # Promo Optimization
    path('promo/smart-feed/', promo_opt_viewset.smart_feed, name='promo-smart-feed'),
    path('promo/promo-click/', promo_opt_viewset.promo_click, name='promo-promo-click'),
    path('promo/analytics/', promo_opt_viewset.analytics, name='promo-analytics'),
]
