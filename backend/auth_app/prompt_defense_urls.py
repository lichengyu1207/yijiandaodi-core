"""Prompt注入对抗URL路由"""

from django.urls import path
from . import prompt_defense_views

urlpatterns = [
    path('validate/', prompt_defense_views.validate_input, name='validate_input'),
    path('adversarial/', prompt_defense_views.detect_adversarial, name='detect_adversarial'),
    path('honeypot/', prompt_defense_views.detect_honeypot, name='detect_honeypot'),
    path('comprehensive/', prompt_defense_views.comprehensive_defense, name='comprehensive_defense'),
    path('metrics/', prompt_defense_views.defense_metrics, name='defense_metrics'),
    path('history/', prompt_defense_views.attack_history, name='attack_history'),
    path('comparison/', prompt_defense_views.defense_comparison, name='defense_comparison'),
]