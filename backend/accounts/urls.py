from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CustomTokenObtainPairView,
    CustomerBulkCreateView,
    CustomerBulkDeleteView,
    LogoutView,
    MeView,
    CustomerListCreateView,
    CustomerDetailView,
)

urlpatterns = [
    # JWT auth
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),

    # Current user
    path('me/', MeView.as_view(), name='me'),

    # Customer management (admin only)
    path('customers/', CustomerListCreateView.as_view(), name='customer-list'),
    path('customers/<int:pk>/', CustomerDetailView.as_view(), name='customer-detail'),
    path('customers/bulk/',         CustomerBulkCreateView.as_view(),  name='customer-bulk-create'),
    path('customers/bulk-delete/',  CustomerBulkDeleteView.as_view(),  name='customer-bulk-delete'),
]
