from django.urls import path
from .views import (
    ItemListCreateView, ItemDetailView, ItemBulkCreateView, ItemBulkDeleteView,
    BorrowEntryListCreateView, BorrowEntryDetailView, BorrowSummaryView, BorrowBulkDeleteView,
    PaymentListCreateView, VerifyPaymentView, PaymentBulkDeleteView,
    ShopSettingsView,
    AdminDashboardView, CustomerDashboardView,
)

urlpatterns = [
    # Items
    path('items/',               ItemListCreateView.as_view(),  name='item-list'),
    path('items/bulk/',          ItemBulkCreateView.as_view(),  name='item-bulk-create'),
    path('items/bulk-delete/',   ItemBulkDeleteView.as_view(),  name='item-bulk-delete'),
    path('items/<int:pk>/',      ItemDetailView.as_view(),      name='item-detail'),

    # Borrow entries
    path('borrows/',              BorrowEntryListCreateView.as_view(), name='borrow-list'),
    path('borrows/summary/',      BorrowSummaryView.as_view(),         name='borrow-summary'),
    path('borrows/bulk-delete/',  BorrowBulkDeleteView.as_view(),      name='borrow-bulk-delete'),
    path('borrows/<int:pk>/',     BorrowEntryDetailView.as_view(),     name='borrow-detail'),

    # Payments
    path('payments/',               PaymentListCreateView.as_view(),   name='payment-list'),
    path('payments/bulk-delete/',   PaymentBulkDeleteView.as_view(),   name='payment-bulk-delete'),
    path('payments/<int:pk>/verify/', VerifyPaymentView.as_view(),     name='payment-verify'),

    # Settings
    path('settings/', ShopSettingsView.as_view(), name='shop-settings'),

    # Dashboards
    path('dashboard/admin/',    AdminDashboardView.as_view(),    name='admin-dashboard'),
    path('dashboard/customer/', CustomerDashboardView.as_view(), name='customer-dashboard'),
]