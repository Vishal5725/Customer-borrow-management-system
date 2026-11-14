import math
from rest_framework import generics, status, filters
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Q

from .models import Item, BorrowEntry, BorrowItem, Payment, ShopSettings, get_customer_financials
from .serializers import (
    ItemSerializer,
    BorrowEntrySerializer,
    CreateBorrowEntrySerializer,
    CreatePaymentSerializer,
    PaymentSerializer,
    VerifyPaymentSerializer,
    ShopSettingsSerializer,
    CustomerDashboardSerializer,
)
from accounts.permissions import IsAdminUser, IsAdminOrOwner


# ── Items ─────────────────────────────────────────────────────────────────────

class ItemListCreateView(generics.ListCreateAPIView):
    serializer_class = ItemSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'rate', 'quantity', 'created_at']

    def get_queryset(self):
        qs = Item.objects.all()
        if not self.request.user.is_admin:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


# ── Borrow Entries ────────────────────────────────────────────────────────────

class BorrowEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'customer']
    ordering_fields = ['created_at', 'updated_at']

    def get_serializer_class(self):
        return CreateBorrowEntrySerializer if self.request.method == 'POST' else BorrowEntrySerializer

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params

        if user.is_admin:
            qs = BorrowEntry.objects.select_related('customer').prefetch_related(
                'items__item', 'payments'
            ).all()
        else:
            qs = BorrowEntry.objects.filter(customer=user).prefetch_related(
                'items__item', 'payments'
            )

        date_from = params.get('date_from')
        date_to   = params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        customer_search = params.get('customer_search')
        if customer_search and user.is_admin:
            qs = qs.filter(
                Q(customer__username__icontains=customer_search) |
                Q(customer__first_name__icontains=customer_search) |
                Q(customer__last_name__icontains=customer_search) |
                Q(customer__phone_number__icontains=customer_search)
            )
        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        serializer = CreateBorrowEntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        return Response(BorrowEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class BorrowEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrOwner]
    serializer_class = BorrowEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_admin:
            return BorrowEntry.objects.prefetch_related('items__item', 'payments__verified_by').all()
        return BorrowEntry.objects.filter(customer=user).prefetch_related('items__item', 'payments')

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated(), IsAdminOrOwner()]


class BorrowSummaryView(APIView):
    """Aggregated integer totals for admin table footer."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        params = request.query_params
        qs = BorrowEntry.objects.prefetch_related('items__item', 'payments').all()

        if params.get('date_from'):
            qs = qs.filter(created_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(created_at__date__lte=params['date_to'])
        if params.get('customer'):
            qs = qs.filter(customer_id=params['customer'])
        if params.get('customer_search'):
            q = params['customer_search']
            qs = qs.filter(
                Q(customer__username__icontains=q) |
                Q(customer__first_name__icontains=q) |
                Q(customer__last_name__icontains=q) |
                Q(customer__phone_number__icontains=q)
            )
        if params.get('status'):
            qs = qs.filter(status=params['status'])

        total_borrowed = sum(e.total_amount for e in qs)
        total_paid_sum = sum(e.total_paid for e in qs)
        total_due      = max(0, total_borrowed - total_paid_sum)
        fins = get_customer_financials(params.get('customer_search') or params.get('customer'))
        return Response({
            'total_borrowed': total_borrowed,
            'total_paid': total_paid_sum,
            'total_due': total_due,
            'advance': fins['advance'],
            'entry_count': qs.count(),
        })


# ── Payments ──────────────────────────────────────────────────────────────────

class PaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return CreatePaymentSerializer if self.request.method == 'POST' else PaymentSerializer

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params

        if user.is_admin:
            qs = Payment.objects.select_related('borrow_entry__customer', 'verified_by').all()
            if params.get('borrow_entry'):
                qs = qs.filter(borrow_entry_id=params['borrow_entry'])
            verified = params.get('verified')
            if verified is not None:
                qs = qs.filter(is_verified=verified.lower() == 'true')
            if params.get('customer'):
                qs = qs.filter(borrow_entry__customer_id=params['customer'])
            if params.get('customer_search'):
                q = params['customer_search']
                qs = qs.filter(
                    Q(borrow_entry__customer__username__icontains=q) |
                    Q(borrow_entry__customer__first_name__icontains=q) |
                    Q(borrow_entry__customer__last_name__icontains=q) |
                    Q(borrow_entry__customer__phone_number__icontains=q)
                )
            if params.get('date_from'):
                qs = qs.filter(paid_at__date__gte=params['date_from'])
            if params.get('date_to'):
                qs = qs.filter(paid_at__date__lte=params['date_to'])
            return qs

        return Payment.objects.select_related(
            'borrow_entry__customer', 'verified_by'
        ).filter(borrow_entry__customer=user)

    def create(self, request, *args, **kwargs):
        serializer = CreatePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        borrow_entry = data.get('borrow_entry')

        if not request.user.is_admin:
            # Customer never selects an entry — auto-pick oldest pending entry
            borrow_entry = (
                BorrowEntry.objects
                .filter(customer=request.user)
                .exclude(status=BorrowEntry.STATUS_PAID)
                .order_by('created_at')
                .first()
            )
            if not borrow_entry:
                return Response(
                    {'detail': 'No pending entries found. Nothing to pay.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Admin must provide borrow_entry
            if not borrow_entry:
                return Response(
                    {'detail': 'borrow_entry is required for admin.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if borrow_entry != data.get('borrow_entry'):
                pass  # admin provided valid entry

        payment = Payment.objects.create(
            borrow_entry=borrow_entry,
            amount=data['amount'],
            method=data['method'],
            screenshot_note=data.get('screenshot_note', ''),
        )
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class VerifyPaymentView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk):
        try:
            payment = Payment.objects.get(pk=pk)
        except Payment.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if payment.is_verified:
            return Response({'detail': 'Already verified.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment.method = serializer.validated_data['method']
        payment.verify(
            admin_user=request.user,
            paid_at=serializer.validated_data.get('paid_at'),
        )
        return Response(PaymentSerializer(payment).data)


# ── Shop Settings ─────────────────────────────────────────────────────────────

class ShopSettingsView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]

    def get(self, request):
        s = ShopSettings.get()
        return Response(ShopSettingsSerializer(s).data)

    def put(self, request):
        s = ShopSettings.get()
        serializer = ShopSettingsSerializer(s, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ── Admin Dashboard ───────────────────────────────────────────────────────────

class AdminDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        from accounts.models import User
        total_customers = User.objects.filter(role='customer').count()
        total_items     = Item.objects.filter(is_active=True).count()
        entries         = BorrowEntry.objects.all()
        pending_count   = entries.exclude(status=BorrowEntry.STATUS_PAID).count()
        paid_count      = entries.filter(status=BorrowEntry.STATUS_PAID).count()

        all_entries = entries.prefetch_related('items__item', 'payments')
        total_borrowed  = sum(e.total_amount for e in all_entries)
        total_paid_sum  = sum(e.total_paid for e in all_entries)
        total_due       = max(0, total_borrowed - total_paid_sum)
        advance = max(0, total_paid_sum - total_borrowed)
        unverified_payments = Payment.objects.filter(is_verified=False).count()

        return Response({
            'total_customers': total_customers,
            'total_items': total_items,
            'borrow_entries': {
                'pending': pending_count,
                'paid': paid_count,
                'total': entries.count(),
            },
            'financials': {
                'total_borrowed': total_borrowed,
                'total_due': total_due,
                'total_collected': total_paid_sum,
                "advance":advance
            },
            'unverified_payments': unverified_payments,
        })


# ── Customer Dashboard ────────────────────────────────────────────────────────

class CustomerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # All monetary calculations happen here — frontend just renders
        fins = get_customer_financials(user)

        recent_entries = BorrowEntry.objects.filter(customer=user).prefetch_related(
            'items__item', 'payments'
        )[:5]

        shop = ShopSettings.get()
        qr_url = request.build_absolute_uri(shop.upi_qr_image.url) if shop.upi_qr_image else None

        return Response({
            'total_payable': fins['total_payable'],
            'total_paid':    fins['total_paid'],
            'advance':       fins['advance'],
            'total_due':     fins['total_due'],
            'entries_count': fins['entries_count'],
            'recent_entries': CustomerDashboardSerializer(recent_entries, many=True).data,
            'shop_whatsapp': shop.whatsapp_number,
            'upi_qr_image':  qr_url,
        })
    

# ── Bulk Item Create ──────────────────────────────────────────────────────────
 
class ItemBulkCreateView(APIView):
    """
    POST /shop/items/bulk/
    Body: { "items": [ {name, rate, quantity?, description?, is_active?}, … ] }
    Returns: { created: count, updated: count, items: [...serialized] }
 
    Uses upsert logic — if an item with the same name already exists its
    rate / quantity / description are updated instead of creating a duplicate.
    Max 500 rows per request.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
 
    def post(self, request):
        from .serializers import BulkItemCreateSerializer
        serializer = BulkItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
 
        all_items = result['created'] + result['updated']
        return Response({
            'created': len(result['created']),
            'updated': len(result['updated']),
            'items': ItemSerializer(all_items, many=True).data,
        }, status=status.HTTP_201_CREATED)
 
 
# ── Bulk delete endpoints ─────────────────────────────────────────────────────
 
class ItemBulkDeleteView(APIView):
    """DELETE /shop/items/bulk-delete/  Body: { "ids": [1,2,3] }"""
    permission_classes = [IsAuthenticated, IsAdminUser]
 
    def delete(self, request):
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Provide a list of ids.'}, status=status.HTTP_400_BAD_REQUEST)
        count, _ = Item.objects.filter(id__in=ids).delete()
        return Response({'deleted': count}, status=status.HTTP_200_OK)
 
 
class BorrowBulkDeleteView(APIView):
    """DELETE /shop/borrows/bulk-delete/  Body: { "ids": [1,2,3] }"""
    permission_classes = [IsAuthenticated, IsAdminUser]
 
    def delete(self, request):
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Provide a list of ids.'}, status=status.HTTP_400_BAD_REQUEST)
        count, _ = BorrowEntry.objects.filter(id__in=ids).delete()
        return Response({'deleted': count}, status=status.HTTP_200_OK)
 
 
class PaymentBulkDeleteView(APIView):
    """
    DELETE /shop/payments/bulk-delete/  Body: { "ids": [1,2,3] }
    Only verified payments can be bulk-deleted this way.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
 
    def delete(self, request):
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Provide a list of ids.'}, status=status.HTTP_400_BAD_REQUEST)
        count, _ = Payment.objects.filter(id__in=ids, is_verified=True).delete()
        return Response({'deleted': count}, status=status.HTTP_200_OK)
 