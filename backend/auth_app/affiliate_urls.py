from django.urls import path
from .affiliate_views import (
    AffiliateViewSet,
    MembershipViewSet,
)

affiliate_viewset = AffiliateViewSet()
membership_viewset = MembershipViewSet()

urlpatterns = [
    path('affiliate/dashboard/', affiliate_viewset.dashboard, name='affiliate-dashboard'),
    path('affiliate/generate-link/', affiliate_viewset.generate_link, name='affiliate-generate-link'),
    path('affiliate/invited-users/', affiliate_viewset.invited_users, name='affiliate-invited-users'),
    path('affiliate/commissions/', affiliate_viewset.commissions, name='affiliate-commissions'),
    path('affiliate/withdraw/', affiliate_viewset.withdraw, name='affiliate-withdraw'),
    path('affiliate/withdrawals/', affiliate_viewset.withdrawals, name='affiliate-withdrawals'),
    path('membership/plans/', membership_viewset.plans, name='membership-plans'),
]
