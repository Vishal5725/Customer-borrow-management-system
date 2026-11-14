from django.contrib import admin
from django.utils.html import format_html
from .models import Item, BorrowEntry, BorrowItem, Payment, ShopSettings


@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'rate', 'quantity', 'is_active', 'preview_image']
    list_filter = ['is_active']
    search_fields = ['name']
    list_editable = ['is_active', 'quantity']

    def preview_image(self, obj):
        if obj.image_url:
            return format_html('<img src="{}" style="height:40px;border-radius:4px"/>', obj.image_url)
        return '—'
    preview_image.short_description = 'Image'


class BorrowItemInline(admin.TabularInline):
    model = BorrowItem
    extra = 0
    readonly_fields = ['rate_at_borrow', 'subtotal']

    # def subtotal(self, obj):
    #     return f'₹{obj.subtotal}'


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ['is_verified', 'verified_at', 'verified_by']


@admin.register(BorrowEntry)
class BorrowEntryAdmin(admin.ModelAdmin):
    list_display = ['id', 'customer', 'status', 'total_amount', 'balance_due', 'created_at']
    list_filter = ['status']
    search_fields = ['customer__username', 'customer__first_name']
    inlines = [BorrowItemInline, PaymentInline]
    readonly_fields = ['total_amount', 'total_paid', 'balance_due']

    def total_amount(self, obj): return f'₹{obj.total_amount}'
    def balance_due(self, obj):  return f'₹{obj.balance_due}'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['id', 'borrow_entry', 'amount', 'method', 'is_verified', 'paid_at']
    list_filter = ['is_verified', 'method']
    readonly_fields = ['verified_at', 'verified_by']
    actions = ['mark_verified']

    def mark_verified(self, request, queryset):
        for payment in queryset.filter(is_verified=False):
            payment.verify(admin_user=request.user)
        self.message_user(request, f'Verified {queryset.count()} payment(s).')
    mark_verified.short_description = 'Mark selected payments as verified'


@admin.register(ShopSettings)
class ShopSettingsAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return not ShopSettings.objects.exists()
