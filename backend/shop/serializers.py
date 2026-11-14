import math
from rest_framework import serializers
from .models import Item, BorrowEntry, BorrowItem, Payment, ShopSettings
from accounts.serializers import UserSerializer


def _int(value):
    """Convert any numeric value to a ceiled integer."""
    return math.ceil(float(value)) if value is not None else 0


# ── Item ──────────────────────────────────────────────────────────────────────

class ItemSerializer(serializers.ModelSerializer):
    rate = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = ['id', 'name', 'rate', 'quantity', 'image_url', 'description',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_rate(self, obj):
        return _int(obj.rate)


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentSerializer(serializers.ModelSerializer):
    verified_by_name = serializers.SerializerMethodField()
    method_display   = serializers.CharField(source='get_method_display', read_only=True)
    customer_name    = serializers.SerializerMethodField()
    customer_phone   = serializers.SerializerMethodField()
    amount           = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'borrow_entry', 'amount', 'method', 'method_display',
                  'is_verified', 'paid_at', 'verified_at', 'verified_by',
                  'verified_by_name', 'screenshot_note',
                  'customer_name', 'customer_phone']
        read_only_fields = ['id', 'is_verified', 'verified_at', 'verified_by',
                            'verified_by_name', 'customer_name', 'customer_phone']

    def get_amount(self, obj):
        return _int(obj.amount)

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.first_name or obj.verified_by.username
        return None

    def get_customer_name(self, obj):
        c = obj.borrow_entry.customer
        return c.get_full_name() or c.username

    def get_customer_phone(self, obj):
        return obj.borrow_entry.customer.phone_number


class CreatePaymentSerializer(serializers.Serializer):
    """
    Customer submits payment without selecting an entry.
    borrow_entry is auto-resolved in the view.
    Admin can optionally pass borrow_entry directly.
    """
    amount         = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)
    method         = serializers.ChoiceField(choices=Payment.METHOD_CHOICES, default=Payment.METHOD_ONLINE)
    screenshot_note = serializers.CharField(required=False, allow_blank=True, default='')
    borrow_entry   = serializers.PrimaryKeyRelatedField(
        queryset=BorrowEntry.objects.all(),
        required=False,
        allow_null=True,
        default=None,
    )


class VerifyPaymentSerializer(serializers.Serializer):
    method  = serializers.ChoiceField(choices=Payment.METHOD_CHOICES)
    paid_at = serializers.DateTimeField(required=False)


# ── BorrowItem ────────────────────────────────────────────────────────────────

class BorrowItemSerializer(serializers.ModelSerializer):
    item_name      = serializers.CharField(source='item.name', read_only=True)
    item_image_url = serializers.CharField(source='item.image_url', read_only=True)
    subtotal       = serializers.SerializerMethodField()
    rate_at_borrow = serializers.SerializerMethodField()

    class Meta:
        model = BorrowItem
        fields = ['id', 'item', 'item_name', 'item_image_url', 'quantity',
                  'rate_at_borrow', 'subtotal']
        read_only_fields = ['id', 'item_name', 'item_image_url', 'rate_at_borrow', 'subtotal']

    def get_subtotal(self, obj):
        return _int(obj.subtotal)

    def get_rate_at_borrow(self, obj):
        return _int(obj.rate_at_borrow)


class BorrowItemCreateSerializer(serializers.Serializer):
    item     = serializers.PrimaryKeyRelatedField(queryset=Item.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)


# ── BorrowEntry ───────────────────────────────────────────────────────────────

class BorrowEntrySerializer(serializers.ModelSerializer):
    items          = BorrowItemSerializer(many=True, read_only=True)
    payments       = PaymentSerializer(many=True, read_only=True)
    customer_name  = serializers.SerializerMethodField()
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)
    total_amount   = serializers.SerializerMethodField()
    total_paid     = serializers.SerializerMethodField()
    balance_due    = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = BorrowEntry
        fields = ['id', 'customer', 'customer_name', 'customer_phone',
                  'status', 'status_display', 'notes', 'created_at', 'updated_at',
                  'items', 'payments', 'total_amount', 'total_paid', 'balance_due']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']

    def get_customer_name(self, obj):
        return obj.customer.get_full_name() or obj.customer.username

    def get_total_amount(self, obj):
        return obj.total_amount          # already integer (sum of ceiled subtotals)

    def get_total_paid(self, obj):
        return obj.total_paid            # already integer

    def get_balance_due(self, obj):
        return max(0, obj.balance_due)   # clamp: never expose negative due to customer


class CreateBorrowEntrySerializer(serializers.Serializer):
    customer   = serializers.PrimaryKeyRelatedField(
        queryset=__import__('accounts').models.User.objects.filter(role='customer')
    )
    items      = BorrowItemCreateSerializer(many=True, min_length=1)
    notes      = serializers.CharField(required=False, allow_blank=True)
    created_at = serializers.DateTimeField(required=False)

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        entry = BorrowEntry.objects.create(**validated_data)
        for item_data in items_data:
            BorrowItem.objects.create(
                borrow_entry=entry,
                item=item_data['item'],
                quantity=item_data['quantity'],
                rate_at_borrow=item_data['item'].rate,
            )
        # Auto-resolve status: if customer has advance, this entry might be pre-paid
        from .models import get_customer_financials
        fins = get_customer_financials(entry.customer)
        if fins['total_due'] == 0:
            entry.status = BorrowEntry.STATUS_PAID
            entry.save()
        return entry


# ── ShopSettings ──────────────────────────────────────────────────────────────

class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = ['shop_name', 'whatsapp_number', 'upi_qr_image']


# ── Customer dashboard entry summary ─────────────────────────────────────────

class CustomerDashboardSerializer(serializers.ModelSerializer):
    """Lightweight per-entry row for the dashboard Recent Borrows list."""
    items_count  = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = BorrowEntry
        # No status, no entry id visible to customer in recent list
        fields = ['id', 'total_amount', 'items_count', 'created_at']

    def get_items_count(self, obj):
        return obj.items.count()

    def get_total_amount(self, obj):
        return obj.total_amount