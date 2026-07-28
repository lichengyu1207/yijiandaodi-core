"""用户旅程管理URL路由"""

from django.urls import path
from . import journey_views

urlpatterns = [
    path('create/', journey_views.create_journey, name='create_journey'),
    path('update/', journey_views.update_progress, name='update_progress'),
    path('summary/', journey_views.journey_summary, name='journey_summary'),
    path('plan/', journey_views.journey_plan, name='journey_plan'),
    path('brand/', journey_views.brand_experience, name='brand_experience'),
    path('feedback/', journey_views.record_feedback, name='record_feedback'),
    path('positioning/', journey_views.brand_positioning, name='brand_positioning'),
]